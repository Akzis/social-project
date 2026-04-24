<template>
	<main class="min-h-dvh bg-[#f4f4f5]">
		<section class="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 pb-10 pt-10 text-center">
			<article class="mt-10 rounded-[28px] bg-[#ececef] px-6 pb-10 pt-12">
				<h1 class="text-[52px] leading-[0.95] font-semibold tracking-[-0.03em] text-[#3f75df]">
					ПОИСК
					<br>
					ПОМОЩИ
				</h1>

				<div
					v-if="screenState === 'searching'"
					class="mt-10"
				>
					<div class="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-[#9ec4e5] border-t-[#3f75df]" />
					<p class="mt-6 text-[22px] leading-[1.08] font-medium text-black/75">
						Ищем волонтера для звонка...
					</p>
				</div>

				<div
					v-else-if="screenState === 'found'"
					class="mt-10"
				>
					<p class="text-[30px] leading-[1.04] font-semibold text-[#3f75df]">
						Помощник найден!
					</p>
					<p class="mt-3 text-[22px] leading-[1.08] font-medium text-black/75">
						Подключаем звонок...
					</p>
				</div>

				<div
					v-else
					class="mt-10 flex flex-col items-center"
				>
					<p class="text-[30px] leading-[1.04] font-semibold text-black/80">
						Волонтер не найден :(
					</p>
					<p class="mt-3 text-[22px] leading-[1.08] font-medium text-black/65">
						Попробуем еще раз?
					</p>
					<p class="mt-4 max-w-[320px] text-[20px] leading-[1.14] font-medium text-black/60">
						Можно воспользоваться нейросетью: задать вопрос или определить объекты камерой.
					</p>
					<p class="mt-3 max-w-[330px] text-[17px] leading-[1.2] text-black/60">
						Кнопки: «Попробовать снова», «Спросить ИИ», «Определить объекты», «Главный экран».
					</p>
					<p class="mt-1 max-w-[330px] text-[17px] leading-[1.2] text-black/60">
						Голосом скажи: «попробовать снова», «спросить ИИ», «определить объекты» или «главный экран».
					</p>
					<p class="mt-1 text-[16px] font-medium text-black/65">
						Голосовое управление: {{ voiceControlLabel }}
					</p>

					<button
						type="button"
						class="mt-7 h-[92px] w-full max-w-[360px] rounded-[28px] bg-[#50a9ed] px-5 text-[30px] leading-none font-semibold text-[#f4f4f5] transition hover:brightness-105"
						:disabled="isBusy"
						@click="retrySearch"
					>
						Попробовать снова
					</button>

					<div class="mt-4 flex w-full max-w-[360px] flex-col gap-3">
						<button
							type="button"
							class="h-[92px] w-full rounded-[28px] bg-[#3f75df] px-5 text-[30px] leading-none font-semibold text-[#f4f4f5] transition hover:brightness-105"
							@click="openAiAssistant"
						>
							Спросить ИИ
						</button>
						<button
							type="button"
							class="h-[92px] w-full rounded-[28px] bg-[#3f75df] px-5 text-[30px] leading-none font-semibold text-[#f4f4f5] transition hover:brightness-105"
							@click="openObjectDetection"
						>
							Определить объекты
						</button>
					</div>
				</div>
			</article>

			<NuxtLink
				to="/blind/home"
				class="mx-auto mt-8 flex h-[92px] w-full max-w-[360px] items-center justify-center rounded-[28px] bg-black px-5 text-[30px] leading-none font-semibold text-[#f4f4f5] transition hover:brightness-110"
			>
				Главный экран
			</NuxtLink>
		</section>
	</main>
</template>

<script setup lang="ts">
const SEARCH_TIMEOUT_MS = 20000;
const POLL_INTERVAL_MS = 1000;
const SEARCH_ANNOUNCEMENT_TEXT = "Ищем волонтера";
const SEARCH_SAFETY_ANNOUNCEMENT_TEXT = "Если захочешь завершить звонок, зажми экран на 10 секунд. Не делись личными данными — например, номером карты или адресом. Наши волонтёры проверены, но важно соблюдать осторожность.";
const FOUND_ANNOUNCEMENT_TEXT = "Начинаем звонок";
const NOT_FOUND_ANNOUNCEMENT_TEXT = "Волонтер не найден. Доступны кнопки: Попробовать снова, Спросить ИИ, Определить объекты и Главный экран. Голосом скажи: попробовать снова, спросить ИИ, определить объекты или главный экран.";
const FOUND_NAVIGATION_DELAY_MS = 1900;
const ONBOARDING_INTERESTS_KEY = "volunteer_onboarding_interests";

type HelpScreenState = "searching" | "found" | "not_found";
type NotFoundVoiceCommand = "retry" | "ai" | "objects" | "home";
type SpeechRecognitionLike = {
	lang: string
	continuous: boolean
	interimResults: boolean
	maxAlternatives: number
	onstart: (() => void) | null
	onresult: ((event: any) => void) | null
	onerror: ((event: { error?: string }) => void) | null
	onend: (() => void) | null
	start: () => void
	stop: () => void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

const route = useRoute();
const call = useCallMatching();
const auth = useStrapiAuth();

const screenState = ref<HelpScreenState>("searching");
const isBusy = ref(false);
const watchRunId = ref(0);
const isVoiceControlEnabled = ref(false);
const voiceControlSupported = ref(false);
const voiceControlLabel = computed(() => {
	if (!voiceControlSupported.value) {
		return "не поддерживается";
	}
	return isVoiceControlEnabled.value ? "включено" : "выключено";
});

let speechUtterance: SpeechSynthesisUtterance | null = null;
let audioContext: AudioContext | null = null;
let recognition: SpeechRecognitionLike | null = null;
let keepListeningForCommands = false;
let restartListeningTimer: ReturnType<typeof setTimeout> | null = null;
let isRunningVoiceCommand = false;

const VOICE_RETRY_KEYWORDS = ["попробовать снова", "ищи снова", "найди снова", "повтори поиск"];
const VOICE_AI_KEYWORDS = ["спросить ии", "спросить ай", "нейросеть", "задай вопрос"];
const VOICE_OBJECTS_KEYWORDS = ["определить объекты", "объекты", "камера объектов", "распознать объекты"];
const VOICE_HOME_KEYWORDS = ["главный экран", "домой", "на главный экран"];

const sessionId = computed(() => {
	const raw = String(route.query.session || call.currentSessionId.value || "").trim();
	return raw;
});

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function stopSearchAnnouncement(): void {
	if (!import.meta.client || typeof window === "undefined" || !("speechSynthesis" in window)) {
		speechUtterance = null;
		return;
	}

	window.speechSynthesis.cancel();
	speechUtterance = null;
}

function clearVoiceRestartTimer(): void {
	if (!restartListeningTimer) {
		return;
	}

	clearTimeout(restartListeningTimer);
	restartListeningTimer = null;
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
	if (!import.meta.client || typeof window === "undefined") {
		return null;
	}

	const speechWindow = window as Window & {
		SpeechRecognition?: SpeechRecognitionCtor
		webkitSpeechRecognition?: SpeechRecognitionCtor
	};

	return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
}

function normalizeVoiceInput(value: string): string {
	return value
		.toLowerCase()
		.split("ё").join("е")
		.replace(/[^a-zа-я0-9\s]/gi, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function detectVoiceCommand(rawTranscript: string): NotFoundVoiceCommand | null {
	const transcript = normalizeVoiceInput(rawTranscript);
	if (!transcript) {
		return null;
	}

	if (VOICE_RETRY_KEYWORDS.some(keyword => transcript.includes(keyword))) {
		return "retry";
	}

	if (VOICE_AI_KEYWORDS.some(keyword => transcript.includes(keyword))) {
		return "ai";
	}

	if (VOICE_OBJECTS_KEYWORDS.some(keyword => transcript.includes(keyword))) {
		return "objects";
	}

	if (VOICE_HOME_KEYWORDS.some(keyword => transcript.includes(keyword))) {
		return "home";
	}

	return null;
}

function stopVoiceControl(): void {
	keepListeningForCommands = false;
	clearVoiceRestartTimer();
	isVoiceControlEnabled.value = false;

	if (!recognition) {
		return;
	}

	try {
		recognition.stop();
	} catch {
		// noop
	}
}

function getAudioContext(): AudioContext | null {
	if (!import.meta.client || typeof window === "undefined") {
		return null;
	}

	if (audioContext) {
		return audioContext;
	}

	const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!AudioContextCtor) {
		return null;
	}

	audioContext = new AudioContextCtor();
	return audioContext;
}

async function playNotificationSound(): Promise<void> {
	const context = getAudioContext();
	if (!context) {
		return;
	}

	if (context.state === "suspended") {
		try {
			await context.resume();
		} catch {
			return;
		}
	}

	const startTime = context.currentTime + 0.01;
	const oscillator = context.createOscillator();
	const gain = context.createGain();
	oscillator.type = "sine";
	oscillator.frequency.setValueAtTime(880, startTime);

	gain.gain.setValueAtTime(0.0001, startTime);
	gain.gain.exponentialRampToValueAtTime(0.06, startTime + 0.015);
	gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.18);

	oscillator.connect(gain);
	gain.connect(context.destination);
	oscillator.start(startTime);
	oscillator.stop(startTime + 0.18);
}

async function playJoyfulSound(): Promise<void> {
	const context = getAudioContext();
	if (!context) {
		return;
	}

	if (context.state === "suspended") {
		try {
			await context.resume();
		} catch {
			return;
		}
	}

	const startTime = context.currentTime + 0.01;
	const notes = [
		{ frequency: 740, duration: 0.12, gain: 0.045 },
		{ frequency: 988, duration: 0.16, gain: 0.05 }
	];

	let offset = 0;
	for (const note of notes) {
		const oscillator = context.createOscillator();
		const gain = context.createGain();
		oscillator.type = "sine";
		oscillator.frequency.setValueAtTime(note.frequency, startTime + offset);

		gain.gain.setValueAtTime(0.0001, startTime + offset);
		gain.gain.exponentialRampToValueAtTime(note.gain, startTime + offset + 0.015);
		gain.gain.exponentialRampToValueAtTime(0.0001, startTime + offset + note.duration);

		oscillator.connect(gain);
		gain.connect(context.destination);
		oscillator.start(startTime + offset);
		oscillator.stop(startTime + offset + note.duration);
		offset += note.duration + 0.02;
	}
}

function runSearchAnnouncement(): void {
	stopSearchAnnouncement();
	stopVoiceControl();
	void playNotificationSound();

	if (!import.meta.client || typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
		startVoiceControl();
		return;
	}

	const utterance = new SpeechSynthesisUtterance(SEARCH_ANNOUNCEMENT_TEXT);
	utterance.lang = "ru-RU";
	utterance.rate = 1;
	utterance.pitch = 1;

	utterance.onend = () => {
		if (speechUtterance !== utterance) {
			return;
		}

		speechUtterance = null;
		runSearchSafetyAnnouncement();
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

function runSearchSafetyAnnouncement(): void {
	void playNotificationSound();

	if (!import.meta.client || typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
		return;
	}

	const utterance = new SpeechSynthesisUtterance(SEARCH_SAFETY_ANNOUNCEMENT_TEXT);
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

function runVolunteerFoundAnnouncement(): void {
	stopSearchAnnouncement();
	stopVoiceControl();
	void playJoyfulSound();

	if (!import.meta.client || typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
		return;
	}

	const utterance = new SpeechSynthesisUtterance(FOUND_ANNOUNCEMENT_TEXT);
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

function runVolunteerNotFoundAnnouncement(): void {
	stopSearchAnnouncement();
	stopVoiceControl();
	void playNotificationSound();

	if (!import.meta.client || typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
		return;
	}

	const utterance = new SpeechSynthesisUtterance(NOT_FOUND_ANNOUNCEMENT_TEXT);
	utterance.lang = "ru-RU";
	utterance.rate = 1;
	utterance.pitch = 1;

	utterance.onend = () => {
		if (speechUtterance !== utterance) {
			return;
		}

		speechUtterance = null;
		startVoiceControl();
	};

	utterance.onerror = () => {
		if (speechUtterance !== utterance) {
			return;
		}

		speechUtterance = null;
		startVoiceControl();
	};

	speechUtterance = utterance;
	window.speechSynthesis.speak(utterance);
}

function readBlindInterestsFromStorage(): string {
	const fromProfile = String(auth.profile.value?.interest || "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 360);
	if (fromProfile) {
		return fromProfile;
	}

	if (!import.meta.client || typeof window === "undefined") {
		return "";
	}

	try {
		return String(window.localStorage.getItem(ONBOARDING_INTERESTS_KEY) || "")
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, 360);
	} catch {
		return "";
	}
}

function buildBlindRequestMeta(): { blindProfileId: number | null, blindName: string, blindInterests: string } {
	const profileId = Number(auth.profile.value?.id || 0);
	const blindProfileId = Number.isFinite(profileId) && profileId > 0 ? Math.floor(profileId) : null;
	const blindName = String(
		auth.profile.value?.firstName
		|| auth.onboardingName.value
		|| ""
	).trim();
	const blindInterests = readBlindInterestsFromStorage();

	return {
		blindProfileId,
		blindName,
		blindInterests
	};
}

async function syncBlindInterestToProfileIfNeeded(blindInterests: string): Promise<void> {
	const normalizedInterests = String(blindInterests || "").replace(/\s+/g, " ").trim().slice(0, 360);
	if (!normalizedInterests || !auth.profile.value) {
		return;
	}

	const currentProfileInterests = String(auth.profile.value.interest || "").replace(/\s+/g, " ").trim().slice(0, 360);
	if (currentProfileInterests === normalizedInterests) {
		return;
	}

	if (auth.profileCollection.value === "profiles") {
		try {
			await auth.updateProfile({ interest: normalizedInterests });
		} catch {
			// noop
		}
	}

	try {
		await $fetch("/api/blind/interest/persist", {
			method: "POST",
			body: {
				interest: normalizedInterests,
				profileId: auth.profile.value.id,
				email: auth.profile.value.emailDisplay || auth.user.value?.email || ""
			}
		});
		auth.profile.value.interest = normalizedInterests;
	} catch {
		// noop
	}
}

async function waitForVolunteer(session: string): Promise<void> {
	const runId = watchRunId.value + 1;
	watchRunId.value = runId;
	isBusy.value = true;
	screenState.value = "searching";
	runSearchAnnouncement();
	call.setCurrentSessionId(session);

	const startedAt = Date.now();
	try {
		while (runId === watchRunId.value && Date.now() - startedAt < SEARCH_TIMEOUT_MS) {
			const status = await call.getSessionStatus(session);

			if (status.status === "matched") {
				screenState.value = "found";
				runVolunteerFoundAnnouncement();
				await sleep(FOUND_NAVIGATION_DELAY_MS);

				if (runId !== watchRunId.value) {
					return;
				}

				await navigateTo({
					path: "/blind/conversation",
					query: {
						session,
						...(status.volunteerProfileId ? { volunteerProfileId: String(status.volunteerProfileId) } : {}),
						...(String(status.volunteerProfileDocumentId || "").trim() ? { volunteerProfileDocumentId: String(status.volunteerProfileDocumentId || "").trim() } : {}),
						...(String(status.volunteerName || "").trim() ? { volunteerName: String(status.volunteerName || "").trim() } : {})
					}
				});
				return;
			}

			if (status.status === "ended" || status.status === "expired") {
				screenState.value = "not_found";
				runVolunteerNotFoundAnnouncement();
				return;
			}

			await sleep(POLL_INTERVAL_MS);
		}

		if (runId === watchRunId.value) {
			screenState.value = "not_found";
			runVolunteerNotFoundAnnouncement();
		}
	} catch {
		screenState.value = "not_found";
		runVolunteerNotFoundAnnouncement();
	} finally {
		if (runId === watchRunId.value) {
			isBusy.value = false;
		}
	}
}

async function retrySearch(): Promise<void> {
	if (isBusy.value) {
		return;
	}

	stopVoiceControl();

	try {
		const requestMeta = buildBlindRequestMeta();
		await syncBlindInterestToProfileIfNeeded(requestMeta.blindInterests);
		const nextSessionId = await call.createHelpRequest(requestMeta);
		await waitForVolunteer(nextSessionId);
	} catch {
		screenState.value = "not_found";
		runVolunteerNotFoundAnnouncement();
	}
}

async function openAiAssistant(): Promise<void> {
	stopSearchAnnouncement();
	stopVoiceControl();
	await navigateTo("/blind/conversation");
}

async function openObjectDetection(): Promise<void> {
	stopSearchAnnouncement();
	stopVoiceControl();
	await navigateTo("/blind/cv");
}

async function openHome(): Promise<void> {
	stopSearchAnnouncement();
	stopVoiceControl();
	await navigateTo("/blind/home");
}

async function executeVoiceCommand(command: NotFoundVoiceCommand): Promise<void> {
	if (screenState.value !== "not_found" || isRunningVoiceCommand) {
		return;
	}

	isRunningVoiceCommand = true;
	try {
		if (command === "retry") {
			await retrySearch();
			return;
		}

		if (command === "ai") {
			await openAiAssistant();
			return;
		}

		if (command === "objects") {
			await openObjectDetection();
			return;
		}

		await openHome();
	} finally {
		isRunningVoiceCommand = false;
	}
}

function startVoiceControl(): void {
	if (screenState.value !== "not_found" || isBusy.value || !voiceControlSupported.value) {
		isVoiceControlEnabled.value = false;
		return;
	}

	const RecognitionCtor = getSpeechRecognitionCtor();
	if (!RecognitionCtor) {
		voiceControlSupported.value = false;
		isVoiceControlEnabled.value = false;
		return;
	}

	if (!recognition) {
		const nextRecognition = new RecognitionCtor();
		nextRecognition.lang = "ru-RU";
		nextRecognition.continuous = true;
		nextRecognition.interimResults = false;
		nextRecognition.maxAlternatives = 1;

		nextRecognition.onstart = () => {
			isVoiceControlEnabled.value = true;
		};

		nextRecognition.onresult = (event: any) => {
			const startIndex = Number(event?.resultIndex || 0);
			let transcript = "";
			const resultsCount = Number(event?.results?.length || 0);
			for (let index = startIndex; index < resultsCount; index += 1) {
				transcript += ` ${String(event?.results?.[index]?.[0]?.transcript || "")}`;
			}

			const command = detectVoiceCommand(transcript);
			if (!command) {
				return;
			}

			void executeVoiceCommand(command);
		};

		nextRecognition.onerror = (event: { error?: string }) => {
			const errorCode = String(event?.error || "");
			if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
				keepListeningForCommands = false;
				isVoiceControlEnabled.value = false;
				return;
			}
		};

		nextRecognition.onend = () => {
			isVoiceControlEnabled.value = false;

			if (!keepListeningForCommands || screenState.value !== "not_found" || isBusy.value) {
				return;
			}

			clearVoiceRestartTimer();
			restartListeningTimer = setTimeout(() => {
				if (!keepListeningForCommands || !recognition || screenState.value !== "not_found" || isBusy.value) {
					return;
				}
				try {
					recognition.start();
				} catch {
					// noop
				}
			}, 350);
		};

		recognition = nextRecognition;
	}

	if (isVoiceControlEnabled.value) {
		return;
	}

	keepListeningForCommands = true;
	clearVoiceRestartTimer();
	try {
		recognition.start();
	} catch {
		// noop
	}
}

onMounted(() => {
	voiceControlSupported.value = Boolean(getSpeechRecognitionCtor());
	if (!sessionId.value) {
		screenState.value = "not_found";
		runVolunteerNotFoundAnnouncement();
		return;
	}

	void waitForVolunteer(sessionId.value);
});

onBeforeUnmount(() => {
	watchRunId.value += 1;
	stopVoiceControl();
	stopSearchAnnouncement();
});
</script>
