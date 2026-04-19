<template>
	<main class="min-h-dvh bg-[linear-gradient(180deg,#c6d2de_0%,#dce4ec_22%,#e9edf1_38%,#eff0f2_58%,#eff0f2_100%)]">
		<section class="mx-auto min-h-dvh w-full max-w-[390px] px-4 pb-34 pt-10">
			<header class="text-center">
				<h1 class="text-[42px] leading-[0.95] font-medium tracking-[-0.03em] text-black">
					{{ firstNameView }}
				</h1>
				<p class="mt-1 text-[13px] leading-none text-black/45">
					{{ emailView }} | {{ helpCount }} помощи
				</p>
			</header>

			<section
				v-if="hasQuoteSection"
				class="relative mt-8 text-center"
			>
				<div class="absolute inset-x-6 top-[58%] h-6 -translate-y-1/2 bg-black/[0.06] blur-md" />
				<h2 class="relative text-[28px] leading-none font-medium tracking-[-0.025em] text-black">
					Что про тебя думают?
				</h2>
				<p class="relative mx-auto mt-4 max-w-[300px] text-[15px] leading-[1.2] font-medium tracking-[-0.01em] text-black">
					{{ quoteTextView }}
				</p>
				<div class="relative mx-auto mt-3 h-[4px] w-14 rounded-full bg-[#4f8fea]" />
			</section>

			<section class="mt-10">
				<h3 class="text-center text-[30px] leading-none font-medium tracking-[-0.025em] text-black">
					Настройки
				</h3>
				<p class="mt-2 text-center text-[22px] leading-none font-medium tracking-[-0.02em] text-black">
					Уведомления
				</p>

				<div class="mt-4 flex items-center justify-between rounded-full bg-[#e3e3e6] px-4 py-2">
					<p class="text-[14px] leading-none font-medium text-black">
						Звук Уведомлений
					</p>
					<button
						type="button"
						class="relative h-7 w-[46px] rounded-full border border-[#4f8fea]/60 transition"
						:class="soundEnabled ? 'bg-[#4f8fea]' : 'bg-white'"
						:disabled="soundSaving"
						@click="toggleSound"
					>
						<span
							class="absolute top-[2px] h-[21px] w-[21px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition"
							:class="soundEnabled ? 'left-[21px]' : 'left-[2px]'"
						/>
					</button>
				</div>
			</section>

			<section class="mt-8">
				<h3 class="text-center text-[24px] leading-none font-medium tracking-[-0.015em] text-black">
					Контакты
				</h3>

				<div class="mt-4 space-y-2">
					<article
						v-for="field in contactFields"
						:key="field.key"
						class="flex items-stretch"
					>
						<div class="flex-1 rounded-[18px] bg-[#e3e3e6] px-4 py-2.5">
							<p class="text-[10px] leading-none font-normal text-black/40">
								{{ field.label }}
							</p>
							<p class="mt-1 text-[16px] leading-none font-medium tracking-[-0.01em] text-black">
								{{ field.value }}
							</p>
						</div>

						<button
							v-if="field.editable"
							type="button"
							class="-ml-2 min-w-[88px] rounded-[18px] bg-[#4f8fea] px-3 text-[14px] leading-none font-medium text-white"
							@click="editField(field.key)"
						>
							{{ field.actionLabel }}
						</button>
					</article>
				</div>
			</section>

			<p
				v-if="statusError"
				class="mt-4 rounded-xl bg-[#fee2e2] px-4 py-2 text-sm text-[#991b1b]"
			>
				{{ statusError }}
			</p>
			<p
				v-if="statusSuccess"
				class="mt-4 rounded-xl bg-[#dcfce7] px-4 py-2 text-sm text-[#166534]"
			>
				{{ statusSuccess }}
			</p>

			<div class="mt-14 text-center">
				<button
					type="button"
					class="mx-auto block w-full rounded-[24px] bg-[#e3e3e6] py-3 text-[16px] leading-none font-medium text-black"
					@click="logout"
				>
					Выйти Из Аккаунта
				</button>
				<button
					type="button"
					class="mt-4 text-[14px] leading-none font-semibold text-[#f22a2a] disabled:opacity-60"
					:disabled="accountDeleting"
					@click="deleteAccount"
				>
					{{ accountDeleting ? "Удаляем..." : "Удаление Аккаунта" }}
				</button>
			</div>
		</section>

		<div
			v-if="editor.open"
			class="fixed inset-0 z-40 flex items-end justify-center bg-black/30 px-4 pb-28 pt-12"
		>
			<div class="w-full max-w-[390px] rounded-[24px] bg-white p-4 shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
				<p class="text-[12px] leading-none font-medium text-black/45">
					{{ editor.label }}
				</p>
				<input
					v-model="editorValue"
					:type="editor.key === 'phone' ? 'tel' : editor.key === 'emailDisplay' ? 'email' : 'text'"
					class="mt-2 w-full rounded-[14px] border border-black/10 bg-[#f5f6f7] px-3 py-2 text-[16px] leading-none text-black outline-none focus:border-[#4f8fea]"
				>

				<div class="mt-4 grid grid-cols-2 gap-2">
					<button
						type="button"
						class="rounded-[14px] bg-[#e9eaed] py-2 text-[14px] leading-none font-medium text-black"
						@click="closeEditor"
					>
						Отмена
					</button>
					<button
						type="button"
						class="rounded-[14px] bg-[#4f8fea] py-2 text-[14px] leading-none font-medium text-white disabled:opacity-60"
						:disabled="saving"
						@click="saveEditor"
					>
						Сохранить
					</button>
				</div>
			</div>
		</div>

		<SharedBottomNav active="profile" />
	</main>
</template>

<script setup lang="ts">
type EditableKey = "firstName" | "lastName" | "phone" | "emailDisplay" | "quoteText";

const auth = useStrapiAuth();

const loading = ref(true);
const saving = ref(false);
const soundSaving = ref(false);
const accountDeleting = ref(false);
const statusError = ref("");
const statusSuccess = ref("");

const form = reactive({
	firstName: "",
	lastName: "",
	phone: "",
	emailDisplay: "",
	quoteText: ""
});

const fieldLabels: Record<EditableKey, string> = {
	firstName: "Имя",
	lastName: "Фамилия",
	phone: "Телефон",
	emailDisplay: "Email",
	quoteText: "Фраза о себе"
};

const editor = reactive<{
	open: boolean;
	key: EditableKey | null;
	label: string;
}>({
	open: false,
	key: null,
	label: ""
});
const editorValue = ref("");

const helpCount = computed(() => auth.profile.value?.deedsCount ?? 0);
const soundEnabled = computed(() => auth.profile.value?.soundEnabled ?? true);
const firstNameView = computed(() => form.firstName || "Катя");
const emailView = computed(() => form.emailDisplay || auth.user.value?.email || "no-email");
const quoteTextView = computed(() => form.quoteText.trim());
const hasQuoteSection = computed(() => {
	const quote = quoteTextView.value;
	if (!quote) {
		return false;
	}

	// Hide broken mojibake defaults like "РЎРї..." that are not real user quotes.
	const looksLikeMojibake = /(?:Р.|С.|Ð.|Ñ.){4,}/.test(quote);
	return !looksLikeMojibake;
});

const contactFields = computed(() => [
	{
		key: "firstName" as EditableKey,
		label: "Имя",
		value: form.firstName || "-",
		editable: true,
		actionLabel: form.firstName.trim() ? "Изменить" : "Добавить"
	},
	{
		key: "lastName" as EditableKey,
		label: "Фамилия",
		value: form.lastName || "-",
		editable: true,
		actionLabel: form.lastName.trim() ? "Изменить" : "Добавить"
	},
	{
		key: "phone" as EditableKey,
		label: "Номер Телефона",
		value: form.phone || "-",
		editable: true,
		actionLabel: form.phone.trim() ? "Изменить" : "Добавить"
	},
	{
		key: "emailDisplay" as EditableKey,
		label: "Почта",
		value: form.emailDisplay || "-",
		editable: false,
		actionLabel: form.emailDisplay.trim() ? "Изменить" : "Добавить"
	}
]);

watch(
	() => auth.profile.value,
	(profile) => {
		if (!profile) {
			return;
		}

		form.firstName = profile.firstName || "";
		form.lastName = profile.lastName || "";
		form.phone = profile.phone || "";
		form.emailDisplay = profile.emailDisplay || auth.user.value?.email || "";
		form.quoteText = profile.quoteText || "";
	},
	{ immediate: true }
);

onMounted(async () => {
	await refresh();
});

async function refresh(): Promise<void> {
	loading.value = true;
	statusError.value = "";

	try {
		await auth.restoreSession();
		await auth.refreshDashboard();
	} catch (error) {
		statusError.value = auth.normalizeError(error);
	} finally {
		loading.value = false;
	}
}

function editField(key: EditableKey): void {
	editor.open = true;
	editor.key = key;
	editor.label = fieldLabels[key];
	editorValue.value = form[key] || "";
}

function closeEditor(): void {
	editor.open = false;
	editor.key = null;
	editor.label = "";
	editorValue.value = "";
}

function isValidEmail(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function saveEditor(): Promise<void> {
	if (!editor.key) {
		return;
	}

	const nextValue = editorValue.value.trim();
	if (editor.key === "emailDisplay" && nextValue && !isValidEmail(nextValue)) {
		statusError.value = "Введите корректный email.";
		statusSuccess.value = "";
		return;
	}

	form[editor.key] = nextValue;
	const saved = await saveProfile();
	if (saved) {
		closeEditor();
	}
}

async function saveProfile(): Promise<boolean> {
	if (saving.value) {
		return false;
	}

	if (!auth.profile.value) {
		try {
			await auth.refreshDashboard();
		} catch (error) {
			statusError.value = auth.normalizeError(error);
			statusSuccess.value = "";
			return false;
		}

		if (!auth.profile.value) {
			statusError.value = "Профиль не найден. Обновите страницу и попробуйте снова.";
			statusSuccess.value = "";
			return false;
		}
	}

	statusError.value = "";
	statusSuccess.value = "";
	saving.value = true;

	try {
		await auth.updateProfile({
			firstName: form.firstName.trim(),
			lastName: form.lastName.trim(),
			phone: form.phone.trim(),
			quoteText: form.quoteText.trim()
		});
		statusSuccess.value = "Профиль обновлен.";
		return true;
	} catch (error) {
		statusError.value = auth.normalizeError(error);
		return false;
	} finally {
		saving.value = false;
	}
}

async function toggleSound(): Promise<void> {
	if (!auth.profile.value || soundSaving.value) {
		return;
	}

	statusError.value = "";
	statusSuccess.value = "";
	soundSaving.value = true;

	try {
		await auth.updateProfile({
			soundEnabled: !soundEnabled.value
		});
	} catch (error) {
		statusError.value = auth.normalizeError(error);
	} finally {
		soundSaving.value = false;
	}
}

async function logout(): Promise<void> {
	await auth.logout();
	await navigateTo("/");
}

async function deleteAccount(): Promise<void> {
	if (accountDeleting.value) {
		return;
	}

	if (import.meta.client) {
		const approved = window.confirm("Удалить аккаунт без возможности восстановления?");
		if (!approved) {
			return;
		}
	}

	statusError.value = "";
	statusSuccess.value = "";
	accountDeleting.value = true;

	try {
		await auth.deleteAccount();
		await navigateTo("/");
	} catch (error) {
		statusError.value = auth.normalizeError(error);
	} finally {
		accountDeleting.value = false;
	}
}
</script>
