<template>
	<main class="min-h-dvh bg-[#f4f4f5]">
		<section
			class="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-4 px-6 pb-10 pt-8"
			style="max-width:430px; width:100%; margin-inline:auto;"
		>
			<header class="text-center">
				<h1 class="text-[38px] leading-[0.95] font-semibold tracking-[-0.03em] text-[#3f75df]">
					КАМЕРА
					<br>
					ОБЪЕКТОВ
				</h1>
				<p class="mt-2 text-[16px] leading-snug text-black/65">
					Запусти камеру и используй кнопки озвучки.
				</p>
			</header>

			<div class="overflow-hidden rounded-[28px] border border-[#d8d8da] bg-black">
				<video
					ref="remoteVideo"
					autoplay
					playsinline
					muted
					class="h-[260px] w-full object-cover"
				/>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<button
					type="button"
					class="start-button-intro col-span-2 min-h-[110px] rounded-[24px] px-5 py-7 text-[32px] leading-none font-semibold text-[#f4f4f5] disabled:opacity-60"
					:class="isRunning ? 'bg-[#c94e4e]' : 'bg-[#3f75df]'"
					@click="toggleCvSession"
				>
					{{ isConnecting ? "Запуск камеры..." : (isRunning ? "Остановить камеру" : "Запустить камеру") }}
				</button>
				<button
					type="button"
					class="rounded-[22px] bg-[#3f75df] px-5 py-6 text-[24px] leading-tight font-semibold text-[#f4f4f5] disabled:opacity-60"
					:disabled="!detections.length"
					@click="speakTopObject"
				>
					Озвучить объект
				</button>
				<button
					type="button"
					class="rounded-[22px] bg-[#3f75df] px-5 py-6 text-[24px] leading-tight font-semibold text-[#f4f4f5] disabled:opacity-60"
					:disabled="!detections.length"
					@click="speakAllObjects"
				>
					Озвучить все объекты
				</button>
				<button
					type="button"
					class="col-span-2 rounded-[22px] px-5 py-6 text-[24px] leading-tight font-semibold text-[#f4f4f5] disabled:opacity-60"
					:class="isVoiceControlEnabled ? 'bg-[#2f944e]' : 'bg-[#3f75df]'"
					:disabled="!voiceControlSupported"
					@click="toggleVoiceControl"
				>
					{{ isVoiceControlEnabled ? "Выключить голосовое управление" : "Включить голосовое управление" }}
				</button>
			</div>

			<div class="rounded-[18px] bg-white px-4 py-4">
				<p class="text-[18px] font-semibold text-black/80">
					Голосовое управление
				</p>
				<p class="mt-2 text-[16px] leading-snug text-black/70">
					Скажи: «Озвучь объект» или «Озвучь все объекты».
				</p>
				<p class="mt-1 text-[15px] leading-snug text-black/60">
					Сначала нажми кнопку «Включить голосовое управление» и разреши доступ к микрофону.
				</p>
				<p class="mt-2 text-[15px] font-medium text-black/70">
					Статус микрофона: {{ voiceControlLabel }}
				</p>
			</div>

			<div class="rounded-[18px] bg-white px-4 py-3">
				<p class="text-[16px] font-semibold text-black/70">
					Статус: {{ statusLabel }}
				</p>
				<p class="mt-1 text-[14px] text-black/60">
					FPS: {{ fpsLabel }} | Инференс: {{ inferenceLabel }} | Объектов: {{ detections.length }}
				</p>
			</div>

			<p
				v-if="statusMessage"
				aria-live="polite"
				class="text-center text-[16px] font-medium text-black/65"
			>
				{{ statusMessage }}
			</p>

			<div class="max-h-[180px] overflow-y-auto rounded-[18px] bg-white px-4 py-3">
				<p
					v-if="!detections.length"
					class="text-[15px] text-black/55"
				>
					Пока не найдено объектов.
				</p>
				<ul
					v-else
					class="space-y-2"
				>
					<li
						v-for="(item, index) in detections.slice(0, 12)"
						:key="`${item.className}-${index}`"
						class="rounded-[12px] bg-[#f1f2f5] px-3 py-2 text-[15px] text-black/80"
					>
						<p class="font-semibold">
							Русский: {{ toRussianClassName(item.className) }}
						</p>
						<p class="text-[13px] text-black/55">
							English: {{ toEnglishClassName(item.className) }}
						</p>
					</li>
				</ul>
			</div>

			<button
				type="button"
				class="mt-auto w-full rounded-[22px] border border-[#d8d8da] bg-white py-6 text-[28px] leading-none font-semibold text-black transition hover:bg-[#efeff1]"
				@click="navigateBack"
			>
				Назад
			</button>
		</section>
	</main>
</template>

<script setup lang="ts">
interface CvOfferPayload {
	sdp: string
	type: "offer"
}

interface CvAnswerPayload {
	sdp: string
	type: "answer"
}

interface CvDetectionPayload {
	className: string
	confidence: number
	bbox?: {
		x?: number
		y?: number
		w?: number
		h?: number
	}
}

interface CvDetectionsEventPayload {
	type: "detections"
	frameId: number
	fps: number
	inferenceMs: number
	detections: CvDetectionPayload[]
}

type BrowserSpeechRecognitionResult = {
	0?: {
		transcript?: string
	}
}

type BrowserSpeechRecognitionEvent = {
	resultIndex?: number
	results: ArrayLike<BrowserSpeechRecognitionResult>
}

type BrowserSpeechRecognition = {
	lang: string
	continuous: boolean
	interimResults: boolean
	maxAlternatives: number
	start: () => void
	stop: () => void
	abort: () => void
	onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null
	onerror: ((event: { error?: string }) => void) | null
	onend: (() => void) | null
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition

const remoteVideo = ref<HTMLVideoElement | null>(null);
const isRunning = ref(false);
const isConnecting = ref(false);
const statusLabel = ref("idle");
const statusMessage = ref("");
const detections = ref<CvDetectionPayload[]>([]);
const fpsLabel = ref("0");
const inferenceLabel = ref("0 мс");
const isVoiceControlEnabled = ref(false);
const voiceControlLabel = computed(() => {
	if (!voiceControlSupported.value) {
		return "не поддерживается в этом браузере";
	}
	return isVoiceControlEnabled.value ? "включен" : "выключен";
});
const voiceControlSupported = ref(false);
const START_HINT_TEXT = "Это режим распознавания объектов. Нажми кнопку Запустить камеру.";

let localStream: MediaStream | null = null;
let peerConnection: RTCPeerConnection | null = null;
let detectionsChannel: RTCDataChannel | null = null;
let speechUtterance: SpeechSynthesisUtterance | null = null;
let voiceRecognition: BrowserSpeechRecognition | null = null;
const VOICE_COMMANDS_INSTRUCTION = "Скажи: озвучь объект или озвучь все объекты.";

const CV_CLASS_TRANSLATIONS: Record<string, string> = {
	person: "человек",
	bicycle: "велосипед",
	car: "машина",
	motorcycle: "мотоцикл",
	motorbike: "мотоцикл",
	airplane: "самолет",
	aeroplane: "самолет",
	bus: "автобус",
	train: "поезд",
	truck: "грузовик",
	boat: "лодка",
	"traffic light": "светофор",
	"fire hydrant": "пожарный гидрант",
	"stop sign": "знак стоп",
	"parking meter": "паркомат",
	bench: "скамейка",
	bird: "птица",
	cat: "кошка",
	dog: "собака",
	horse: "лошадь",
	sheep: "овца",
	cow: "корова",
	elephant: "слон",
	bear: "медведь",
	zebra: "зебра",
	giraffe: "жираф",
	backpack: "рюкзак",
	umbrella: "зонт",
	handbag: "сумка",
	tie: "галстук",
	suitcase: "чемодан",
	frisbee: "фрисби",
	skis: "лыжи",
	snowboard: "сноуборд",
	"sports ball": "мяч",
	kite: "воздушный змей",
	"baseball bat": "бейсбольная бита",
	"baseball glove": "бейсбольная перчатка",
	skateboard: "скейтборд",
	surfboard: "серфборд",
	"tennis racket": "теннисная ракетка",
	bottle: "бутылка",
	"wine glass": "бокал",
	cup: "чашка",
	fork: "вилка",
	knife: "нож",
	spoon: "ложка",
	bowl: "миска",
	banana: "банан",
	apple: "яблоко",
	sandwich: "сэндвич",
	orange: "апельсин",
	broccoli: "брокколи",
	carrot: "морковь",
	"hot dog": "хот-дог",
	pizza: "пицца",
	donut: "пончик",
	cake: "торт",
	chair: "стул",
	couch: "диван",
	sofa: "диван",
	"potted plant": "растение в горшке",
	bed: "кровать",
	"dining table": "обеденный стол",
	toilet: "туалет",
	tv: "телевизор",
	monitor: "монитор",
	laptop: "ноутбук",
	mouse: "мышь",
	remote: "пульт",
	keyboard: "клавиатура",
	"cell phone": "телефон",
	cellphone: "телефон",
	microwave: "микроволновка",
	oven: "духовка",
	toaster: "тостер",
	sink: "раковина",
	refrigerator: "холодильник",
	fridge: "холодильник",
	book: "книга",
	clock: "часы",
	vase: "ваза",
	scissors: "ножницы",
	"teddy bear": "плюшевый медведь",
	"hair drier": "фен",
	"hair dryer": "фен",
	toothbrush: "зубная щетка"
};

function toEnglishClassName(value: unknown): string {
	const normalized = String(value || "").trim().toLowerCase();
	return normalized || "object";
}

function toRussianClassName(value: unknown): string {
	const englishName = toEnglishClassName(value);
	return CV_CLASS_TRANSLATIONS[englishName] || "объект";
}

function resetDetectionsState(): void {
	detections.value = [];
	fpsLabel.value = "0";
	inferenceLabel.value = "0 мс";
}

function stopSpeech(): void {
	if (!import.meta.client || typeof window === "undefined" || !("speechSynthesis" in window)) {
		speechUtterance = null;
		return;
	}

	window.speechSynthesis.cancel();
	speechUtterance = null;
}

function getVoiceRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
	if (!import.meta.client || typeof window === "undefined") {
		return null;
	}

	const SpeechRecognitionConstructor = (window as unknown as {
		SpeechRecognition?: BrowserSpeechRecognitionConstructor
		webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
	}).SpeechRecognition || (window as unknown as {
		SpeechRecognition?: BrowserSpeechRecognitionConstructor
		webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
	}).webkitSpeechRecognition;
	return SpeechRecognitionConstructor || null;
}

function parseVoiceCommand(rawText: string): "single" | "all" | null {
	const normalized = rawText
		.toLowerCase()
		.replace(/ё/g, "е")
		.replace(/[^a-zа-я0-9\s]/gi, " ")
		.replace(/\s+/g, " ")
		.trim();

	if (!normalized) {
		return null;
	}

	const hasSpeak = normalized.includes("озвуч");
	const hasObject = normalized.includes("объект");
	const hasAll = normalized.includes("все");
	if (hasSpeak && hasObject && hasAll) {
		return "all";
	}

	if (hasSpeak && hasObject) {
		return "single";
	}

	return null;
}

function runVoiceCommand(command: "single" | "all"): void {
	if (command === "all") {
		statusMessage.value = "Голосовая команда: озвучить все объекты.";
		speakAllObjects();
		return;
	}

	statusMessage.value = "Голосовая команда: озвучить объект.";
	speakTopObject();
}

function ensureVoiceRecognition(): boolean {
	if (voiceRecognition) {
		return true;
	}

	const RecognitionConstructor = getVoiceRecognitionConstructor();
	if (!RecognitionConstructor) {
		voiceControlSupported.value = false;
		statusMessage.value = "Голосовое управление не поддерживается в этом браузере.";
		return false;
	}

	const recognition = new RecognitionConstructor();
	recognition.lang = "ru-RU";
	recognition.continuous = true;
	recognition.interimResults = false;
	recognition.maxAlternatives = 1;

	recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
		const startIndex = Number.isFinite(Number(event.resultIndex)) ? Number(event.resultIndex) : 0;
		let transcript = "";
		for (let index = startIndex; index < event.results.length; index += 1) {
			const result = event.results[index];
			transcript += `${result?.[0]?.transcript || ""} `;
		}

		const command = parseVoiceCommand(transcript);
		if (!command) {
			return;
		}

		runVoiceCommand(command);
	};

	recognition.onerror = (event: { error?: string }) => {
		const errorCode = String(event?.error || "");
		if (errorCode === "not-allowed") {
			statusMessage.value = "Доступ к микрофону запрещен. Разреши доступ к микрофону в браузере.";
			isVoiceControlEnabled.value = false;
			return;
		}

		if (errorCode === "aborted") {
			return;
		}

		statusMessage.value = "Голосовое управление временно недоступно.";
	};

	recognition.onend = () => {
		if (!isVoiceControlEnabled.value) {
			return;
		}

		window.setTimeout(() => {
			if (!isVoiceControlEnabled.value || !voiceRecognition) {
				return;
			}
			try {
				voiceRecognition.start();
			} catch {
				// noop
			}
		}, 250);
	};

	voiceRecognition = recognition;
	return true;
}

function stopVoiceControl(): void {
	isVoiceControlEnabled.value = false;
	if (!voiceRecognition) {
		return;
	}

	try {
		voiceRecognition.stop();
	} catch {
		// noop
	}
}

function startVoiceControl(options: { silentStatus?: boolean } = {}): boolean {
	if (isVoiceControlEnabled.value) {
		return true;
	}

	if (!ensureVoiceRecognition() || !voiceRecognition) {
		return false;
	}

	try {
		voiceRecognition.start();
		isVoiceControlEnabled.value = true;
		if (!options.silentStatus) {
			statusMessage.value = "Голосовое управление включено.";
		}
		return true;
	} catch {
		statusMessage.value = "Не удалось включить голосовое управление.";
		return false;
	}
}

function toggleVoiceControl(): void {
	if (isVoiceControlEnabled.value) {
		stopVoiceControl();
		statusMessage.value = "Голосовое управление выключено.";
		return;
	}

	startVoiceControl();
}

function speakText(text: string): void {
	const normalizedText = String(text || "").trim();
	if (!normalizedText) {
		return;
	}

	if (!import.meta.client || typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
		statusMessage.value = normalizedText;
		return;
	}

	stopSpeech();

	const utterance = new SpeechSynthesisUtterance(normalizedText);
	utterance.lang = "ru-RU";
	utterance.rate = 1;
	utterance.pitch = 1;
	utterance.onend = () => {
		if (speechUtterance !== utterance) {
			return;
		}
		speechUtterance = null;
	};
	utterance.onerror = () => {
		if (speechUtterance !== utterance) {
			return;
		}
		speechUtterance = null;
	};

	speechUtterance = utterance;
	window.speechSynthesis.speak(utterance);
}

function readSortedDetections(): CvDetectionPayload[] {
	return [...detections.value].sort((left, right) => {
		const l = Number(left.confidence || 0);
		const r = Number(right.confidence || 0);
		return r - l;
	});
}

function speakTopObject(): void {
	const top = readSortedDetections()[0];
	if (!top) {
		statusMessage.value = "Сейчас в кадре нет объектов для озвучки.";
		return;
	}

	const russianName = toRussianClassName(top.className);
	speakText(`Обнаружен объект: ${russianName}.`);
}

function speakAllObjects(): void {
	const items = readSortedDetections();
	if (!items.length) {
		statusMessage.value = "Сейчас в кадре нет объектов для озвучки.";
		return;
	}

	const grouped = new Map<string, number>();
	for (const item of items) {
		const russianName = toRussianClassName(item.className);
		grouped.set(russianName, (grouped.get(russianName) || 0) + 1);
	}

	const summary = [...grouped.entries()]
		.slice(0, 10)
		.map(([name, count]) => (count > 1 ? `${count} ${name}` : name))
		.join(", ");

	speakText(`В кадре обнаружено: ${summary}.`);
}

function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
	if (pc.iceGatheringState === "complete") {
		return Promise.resolve();
	}

	return new Promise((resolve) => {
		const timeout = window.setTimeout(() => {
			pc.removeEventListener("icegatheringstatechange", onStateChange);
			resolve();
		}, 2500);

		const onStateChange = () => {
			if (pc.iceGatheringState === "complete") {
				window.clearTimeout(timeout);
				pc.removeEventListener("icegatheringstatechange", onStateChange);
				resolve();
			}
		};

		pc.addEventListener("icegatheringstatechange", onStateChange);
	});
}

function handleDetectionsMessage(raw: string): void {
	if (!raw || raw === "pong") {
		return;
	}

	let payload: CvDetectionsEventPayload | null = null;
	try {
		payload = JSON.parse(raw) as CvDetectionsEventPayload;
	} catch {
		return;
	}

	if (!payload || payload.type !== "detections") {
		return;
	}

	detections.value = Array.isArray(payload.detections) ? payload.detections : [];
	fpsLabel.value = Number.isFinite(Number(payload.fps)) ? Number(payload.fps).toFixed(1) : "0";
	inferenceLabel.value = `${Math.max(0, Math.round(Number(payload.inferenceMs) || 0))} мс`;
}

async function stopCvSession(): Promise<void> {
	stopSpeech();

	if (detectionsChannel) {
		try {
			detectionsChannel.close();
		} catch {
			// noop
		}
		detectionsChannel = null;
	}

	if (peerConnection) {
		try {
			peerConnection.close();
		} catch {
			// noop
		}
		peerConnection = null;
	}

	if (localStream) {
		for (const track of localStream.getTracks()) {
			try {
				track.stop();
			} catch {
				// noop
			}
		}
		localStream = null;
	}

	if (remoteVideo.value) {
		remoteVideo.value.srcObject = null;
	}

	isRunning.value = false;
	isConnecting.value = false;
	statusLabel.value = "idle";
	resetDetectionsState();
}

async function toggleCvSession(): Promise<void> {
	if (isRunning.value || isConnecting.value) {
		await stopCvSession();
		statusMessage.value = "Камера остановлена.";
		return;
	}

	await startCvSession();
}

async function startCvSession(): Promise<void> {
	if (isConnecting.value || isRunning.value) {
		return;
	}

	await stopCvSession();
	isConnecting.value = true;
	statusMessage.value = "Запрашиваю доступ к камере...";
	statusLabel.value = "connecting";

	try {
		localStream = await navigator.mediaDevices.getUserMedia({
			audio: false,
			video: {
				width: { ideal: 960 },
				height: { ideal: 540 },
				frameRate: { ideal: 24, max: 30 },
				facingMode: { ideal: "environment" }
			}
		});

		const pc = new RTCPeerConnection({
			iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
		});
		peerConnection = pc;

		pc.addEventListener("connectionstatechange", () => {
			statusLabel.value = pc.connectionState || "connecting";
			if (pc.connectionState === "connected") {
				statusMessage.value = "Камера подключена. Можно озвучивать объекты.";
			}

			if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
				void stopCvSession();
			}
		});

		pc.addEventListener("track", (event) => {
			if (event.track.kind !== "video") {
				return;
			}

			const stream = event.streams[0] || new MediaStream([event.track]);
			if (remoteVideo.value) {
				remoteVideo.value.srcObject = stream;
			}
		});

		detectionsChannel = pc.createDataChannel("detections", {
			ordered: false,
			maxRetransmits: 0
		});
		detectionsChannel.addEventListener("open", () => {
			if (detectionsChannel?.readyState === "open") {
				detectionsChannel.send("ping");
			}
		});
		detectionsChannel.addEventListener("message", (event) => {
			handleDetectionsMessage(String(event.data || ""));
		});

		for (const track of localStream.getTracks()) {
			pc.addTrack(track, localStream);
		}

		const offer = await pc.createOffer();
		await pc.setLocalDescription(offer);
		await waitForIceGathering(pc);

		const localDescription = pc.localDescription;
		if (!localDescription?.sdp || localDescription.type !== "offer") {
			throw new Error("Не удалось сформировать WebRTC offer.");
		}

	const answer = await $fetch<CvAnswerPayload>("/api/cv/offer", {
			method: "POST",
			body: {
				sdp: localDescription.sdp,
				type: localDescription.type
			} satisfies CvOfferPayload
		});

		await pc.setRemoteDescription(new RTCSessionDescription(answer));

		isRunning.value = true;
		statusLabel.value = pc.connectionState || "connecting";
		const voiceStarted = startVoiceControl({ silentStatus: true });
		if (voiceStarted) {
			statusMessage.value = "Камера запущена. Голосовое управление включено.";
			speakText(`Камера запущена. Голосовое управление включено. ${VOICE_COMMANDS_INSTRUCTION}`);
		} else {
			statusMessage.value = "Камера запущена.";
			speakText("Камера запущена.");
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Не удалось запустить камеру объектов.";
		statusMessage.value = message;
		await stopCvSession();
	} finally {
		isConnecting.value = false;
	}
}

async function navigateBack(): Promise<void> {
	await navigateTo("/blind/home");
}

onMounted(() => {
	voiceControlSupported.value = Boolean(getVoiceRecognitionConstructor());
	statusMessage.value = "Нажми кнопку «Запустить камеру», чтобы начать распознавание объектов.";
	window.setTimeout(() => {
		speakText(START_HINT_TEXT);
	}, 350);
});

onBeforeUnmount(() => {
	stopVoiceControl();
	void stopCvSession();
});
</script>

<style scoped>
@keyframes startButtonIntroGrowShrink {
	0% {
		transform: scale(1.48);
	}
	65% {
		transform: scale(0.96);
	}
	100% {
		transform: scale(1);
	}
}

.start-button-intro {
	animation: startButtonIntroGrowShrink 900ms cubic-bezier(0.22, 1, 0.36, 1) 120ms both;
	will-change: transform;
}

@media (prefers-reduced-motion: reduce) {
	.start-button-intro {
		animation: none;
	}
}
</style>
