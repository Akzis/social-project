<template>
	<main class="min-h-dvh bg-[#f4f4f5]">
		<section class="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 pb-7 pt-8 text-center">
			<template v-if="!hasSession">
				<div class="my-auto">
					<h1 class="text-[52px] leading-[0.95] font-semibold tracking-[-0.03em] text-[#3f75df]">
						РЕЖИМ
						<br>
						РАЗГОВОРА
					</h1>
				</div>
			</template>

			<template v-else>
				<p
					aria-live="polite"
					class="sr-only"
				>
					{{ statusMessage }}
				</p>
				<p
					v-if="cameraMessage"
					class="sr-only"
				>
					{{ cameraMessage }}
				</p>

				<button
					type="button"
					class="mt-[58px] flex flex-1 flex-col items-center rounded-[34px] bg-[#3f75df] px-4 pt-[228px] text-center text-[#f4f4f5] transition active:scale-[0.995]"
					:disabled="isEnding"
					@pointerdown="startEndHold"
					@pointerup="cancelEndHold"
					@pointerleave="cancelEndHold"
					@pointercancel="cancelEndHold"
				>
					<span class="text-[76px] leading-[0.96] font-semibold tracking-[-0.03em]">
						ОСТАНОВИТЬ
						<br>
						РАЗГОВОР
						<br>
						С ПОМОЩНИКОМ
					</span>

					<span class="mt-[118px] text-[90px] leading-[0.9] font-semibold tracking-[-0.03em]">
						ЗАЖМИ
						<br>
						<span class="text-[72px]">НА 5 СЕКУНД</span>
					</span>
				</button>

				<p
					v-if="holdProgress > 0 && holdProgress < 100"
					class="sr-only"
				>
					Удержание: {{ holdProgress }}%
				</p>

				<video
					v-if="showLocalPreview"
					ref="localPreview"
					autoplay
					muted
					playsinline
					class="hidden"
				/>

				<audio
					ref="remoteAudio"
					autoplay
					playsinline
				/>
			</template>
		</section>
	</main>
</template>

<script setup lang="ts">
import type { CallSignalItem } from "~/composables/useCallMatching";

const HOLD_TO_END_MS = 5000;
const SIGNAL_POLL_MS = 700;

const route = useRoute();
const call = useCallMatching();

const activeSessionId = computed(() => String(route.query.session || call.currentSessionId.value || "").trim());
const hasSession = computed(() => activeSessionId.value.length > 0);

const statusMessage = ref("Подключаемся к волонтеру...");
const cameraMessage = ref("");
const holdProgress = ref(0);
const isEnding = ref(false);
const showLocalPreview = ref(false);

const localPreview = useTemplateRef<HTMLVideoElement>("localPreview");
const remoteAudio = useTemplateRef<HTMLAudioElement>("remoteAudio");

let holdTimer: ReturnType<typeof setTimeout> | null = null;
let holdProgressTimer: ReturnType<typeof setInterval> | null = null;
let holdStartedAt = 0;

let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let remoteStream: MediaStream | null = null;
let signalCursor = 0;
let signalPollTimer: ReturnType<typeof setTimeout> | null = null;
let signalPollInFlight = false;
let isPageActive = true;
const pendingRemoteCandidates: RTCIceCandidateInit[] = [];

function clearHoldTimers(): void {
	if (holdTimer) {
		clearTimeout(holdTimer);
		holdTimer = null;
	}

	if (holdProgressTimer) {
		clearInterval(holdProgressTimer);
		holdProgressTimer = null;
	}
}

function clearSignalPollTimer(): void {
	if (!signalPollTimer) {
		return;
	}

	clearTimeout(signalPollTimer);
	signalPollTimer = null;
}

function tryPlay(element: HTMLMediaElement | null): void {
	if (!element) {
		return;
	}

	void element.play().catch(() => {
		// autoplay can be blocked until user interaction
	});
}

async function sendSignal(type: "offer" | "answer" | "candidate" | "end", payload: any): Promise<void> {
	if (!activeSessionId.value) {
		return;
	}

	await call.sendSignal(activeSessionId.value, "blind", type, payload);
}

async function safelyAddRemoteCandidate(candidate: RTCIceCandidateInit): Promise<void> {
	if (!peerConnection) {
		return;
	}

	try {
		await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
	} catch {
		// candidate may become stale while reconnecting
	}
}

async function flushPendingRemoteCandidates(): Promise<void> {
	if (!peerConnection?.remoteDescription) {
		return;
	}

	while (pendingRemoteCandidates.length > 0) {
		const candidate = pendingRemoteCandidates.shift();
		if (!candidate) {
			continue;
		}

		await safelyAddRemoteCandidate(candidate);
	}
}

function ensurePeerConnection(): RTCPeerConnection {
	if (peerConnection) {
		return peerConnection;
	}

	const connection = new RTCPeerConnection({
		iceServers: [
			{ urls: "stun:stun.l.google.com:19302" }
		]
	});

	connection.onicecandidate = (event) => {
		if (!event.candidate || !activeSessionId.value || isEnding.value) {
			return;
		}

		void sendSignal("candidate", event.candidate.toJSON());
	};

	connection.ontrack = (event) => {
		if (!remoteStream) {
			remoteStream = new MediaStream();
		}

		for (const track of event.streams[0]?.getTracks() || [event.track]) {
			if (!remoteStream.getTracks().some(existing => existing.id === track.id)) {
				remoteStream.addTrack(track);
			}
		}

		if (remoteAudio.value) {
			remoteAudio.value.srcObject = remoteStream;
			tryPlay(remoteAudio.value);
		}

		statusMessage.value = "Звонок активен.";
	};

	connection.onconnectionstatechange = () => {
		if (connection.connectionState === "connected") {
			statusMessage.value = "Звонок активен.";
			return;
		}

		if (connection.connectionState === "disconnected") {
			statusMessage.value = "Связь временно прервалась...";
			return;
		}

		if (connection.connectionState === "failed") {
			statusMessage.value = "Не удалось удержать соединение.";
		}
	};

	peerConnection = connection;
	return connection;
}

async function prepareBlindMedia(): Promise<void> {
	const connection = ensurePeerConnection();

	const canUseMediaDevices = import.meta.client
		&& typeof navigator !== "undefined"
		&& Boolean(navigator.mediaDevices?.getUserMedia);
	if (!canUseMediaDevices) {
		cameraMessage.value = "Микрофон недоступен в этом браузере.";
		return;
	}

	try {
		localStream = await navigator.mediaDevices.getUserMedia({
			audio: true,
			video: {
				width: { ideal: 640 },
				height: { ideal: 480 },
				facingMode: "environment"
			}
		});
		cameraMessage.value = "Камера подключена. Волонтер видит видео.";
		showLocalPreview.value = true;
	} catch {
		try {
			localStream = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: false
			});
			cameraMessage.value = "Камера недоступна. Подключен только голос.";
			showLocalPreview.value = false;
		} catch {
			cameraMessage.value = "Не удалось получить доступ к микрофону.";
			return;
		}
	}

	for (const track of localStream.getTracks()) {
		connection.addTrack(track, localStream);
	}

	if (showLocalPreview.value && localPreview.value) {
		localPreview.value.srcObject = localStream;
	}
}

async function handleSignal(signal: CallSignalItem): Promise<void> {
	const connection = ensurePeerConnection();

	if (signal.type === "offer") {
		if (!connection.currentRemoteDescription) {
			await connection.setRemoteDescription(new RTCSessionDescription(signal.payload));
		}
		await flushPendingRemoteCandidates();

		const answer = await connection.createAnswer();
		await connection.setLocalDescription(answer);
		await sendSignal("answer", answer);
		statusMessage.value = "Соединяем с волонтером...";
		return;
	}

	if (signal.type === "candidate") {
		if (!signal.payload) {
			return;
		}

		if (connection.remoteDescription) {
			await safelyAddRemoteCandidate(signal.payload);
		} else {
			pendingRemoteCandidates.push(signal.payload);
		}
		return;
	}

	if (signal.type === "end") {
		statusMessage.value = "Волонтер завершил звонок.";
		isEnding.value = true;
		await cleanupConnection();
		call.setCurrentSessionId(null);
		await navigateTo("/blind/home");
	}
}

async function pollSignals(): Promise<void> {
	if (!isPageActive || !activeSessionId.value || signalPollInFlight) {
		return;
	}

	signalPollInFlight = true;
	try {
		const response = await call.fetchSignals(activeSessionId.value, "blind", signalCursor);
		for (const signal of response.items) {
			signalCursor = Math.max(signalCursor, signal.seq);
			await handleSignal(signal);
		}

		if (response.status === "ended" && !isEnding.value) {
			statusMessage.value = "Звонок завершен.";
			isEnding.value = true;
			await cleanupConnection();
			call.setCurrentSessionId(null);
			await navigateTo("/blind/home");
			return;
		}
	} catch {
		if (!isEnding.value) {
			statusMessage.value = "Проблема связи. Пробуем переподключиться...";
		}
	} finally {
		signalPollInFlight = false;
	}

	if (!isPageActive || !activeSessionId.value || isEnding.value) {
		return;
	}

	clearSignalPollTimer();
	signalPollTimer = setTimeout(() => {
		void pollSignals();
	}, SIGNAL_POLL_MS);
}

async function cleanupConnection(): Promise<void> {
	clearHoldTimers();
	clearSignalPollTimer();
	pendingRemoteCandidates.length = 0;

	if (peerConnection) {
		peerConnection.onicecandidate = null;
		peerConnection.ontrack = null;
		peerConnection.onconnectionstatechange = null;
		peerConnection.close();
		peerConnection = null;
	}

	if (localStream) {
		for (const track of localStream.getTracks()) {
			track.stop();
		}
		localStream = null;
	}

	if (remoteStream) {
		for (const track of remoteStream.getTracks()) {
			track.stop();
		}
		remoteStream = null;
	}

	if (localPreview.value) {
		localPreview.value.srcObject = null;
	}

	if (remoteAudio.value) {
		remoteAudio.value.srcObject = null;
	}
}

async function finishCallByHold(): Promise<void> {
	if (isEnding.value) {
		return;
	}

	isEnding.value = true;
	statusMessage.value = "Завершаю звонок...";

	if (activeSessionId.value) {
		try {
			await call.endSession(activeSessionId.value, "blind");
		} catch {
			// noop
		}
	}

	await cleanupConnection();
	call.setCurrentSessionId(null);
	await navigateTo("/blind/home");
}

function startEndHold(): void {
	if (isEnding.value) {
		return;
	}

	holdProgress.value = 0;
	holdStartedAt = Date.now();
	clearHoldTimers();

	holdTimer = setTimeout(() => {
		holdProgress.value = 100;
		void finishCallByHold();
	}, HOLD_TO_END_MS);

	holdProgressTimer = setInterval(() => {
		const elapsed = Date.now() - holdStartedAt;
		holdProgress.value = Math.max(0, Math.min(99, Math.round((elapsed / HOLD_TO_END_MS) * 100)));
	}, 100);
}

function cancelEndHold(): void {
	if (isEnding.value) {
		return;
	}

	clearHoldTimers();
	if (holdProgress.value < 100) {
		holdProgress.value = 0;
	}
}

async function startConversationSession(): Promise<void> {
	if (!activeSessionId.value) {
		statusMessage.value = "Сессия звонка не найдена.";
		return;
	}

	call.setCurrentSessionId(activeSessionId.value);
	statusMessage.value = "Подключаемся к волонтеру...";
	ensurePeerConnection();
	await prepareBlindMedia();
	await pollSignals();
}

onMounted(() => {
	if (!hasSession.value) {
		return;
	}

	void startConversationSession();
});

onBeforeUnmount(() => {
	isPageActive = false;
	void cleanupConnection();
});
</script>
