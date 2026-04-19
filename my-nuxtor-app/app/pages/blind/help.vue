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

					<button
						type="button"
						class="mt-8 h-[58px] w-full max-w-[280px] rounded-[20px] bg-[#50a9ed] text-[34px] leading-none font-medium text-[#f4f4f5] transition hover:brightness-105"
						:disabled="isBusy"
						@click="retrySearch"
					>
						Попробовать снова
					</button>
				</div>
			</article>

			<NuxtLink
				to="/blind/home"
				class="mx-auto mt-8 flex h-[58px] w-full max-w-[250px] items-center justify-center rounded-[20px] bg-black text-[30px] leading-none font-medium text-[#f4f4f5] transition hover:brightness-110"
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
const FOUND_ANNOUNCEMENT_TEXT = "Волонтер найден! Соеденяем";
const FOUND_NAVIGATION_DELAY_MS = 1900;

type HelpScreenState = "searching" | "found" | "not_found";

const route = useRoute();
const call = useCallMatching();
const auth = useStrapiAuth();

const screenState = ref<HelpScreenState>("searching");
const isBusy = ref(false);
const watchRunId = ref(0);

let speechUtterance: SpeechSynthesisUtterance | null = null;
let audioContext: AudioContext | null = null;

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
	void playNotificationSound();

	if (!import.meta.client || typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
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

function buildBlindRequestMeta(): { blindProfileId: number | null, blindName: string } {
	const profileId = Number(auth.profile.value?.id || 0);
	const blindProfileId = Number.isFinite(profileId) && profileId > 0 ? Math.floor(profileId) : null;
	const blindName = String(
		auth.profile.value?.firstName
		|| auth.onboardingName.value
		|| ""
	).trim();

	return {
		blindProfileId,
		blindName
	};
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
						session
					}
				});
				return;
			}

			if (status.status === "ended" || status.status === "expired") {
				screenState.value = "not_found";
				return;
			}

			await sleep(POLL_INTERVAL_MS);
		}

		if (runId === watchRunId.value) {
			screenState.value = "not_found";
		}
	} catch {
		screenState.value = "not_found";
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

	try {
		const nextSessionId = await call.createHelpRequest(buildBlindRequestMeta());
		await waitForVolunteer(nextSessionId);
	} catch {
		screenState.value = "not_found";
	}
}

onMounted(() => {
	if (!sessionId.value) {
		screenState.value = "not_found";
		return;
	}

	void waitForVolunteer(sessionId.value);
});

onBeforeUnmount(() => {
	watchRunId.value += 1;
	stopSearchAnnouncement();
});
</script>
