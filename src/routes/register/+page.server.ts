import { redirect, type Actions, fail } from '@sveltejs/kit'
import { auth } from '$lib/server/lucia'
import type { PageServerLoad } from './$types'
import { z } from 'zod'
import { superValidate } from 'sveltekit-superforms/server'
import { LuciaError } from 'lucia'
import { findErrorByName } from '$lib/features/user-management/utils/findErrorByName'
import { sendEmailVerificationLink } from '$lib/features/user-management/emails/sendEmailVerificationLink'
import { generateEmailVerificationToken } from '$lib/features/user-management/tokens/generateEmailVerificationToken'
import { verifyUniqueUsername } from '$lib/features/user-management/user/verifyUniqueUsername'
import {
	MAX_PASSWORD_SIZE,
	MIN_PASSWORD_SIZE,
	PASSWORD_CONFIRM_VALIDATION,
	PASSWORD_CONFIRM_VALIDATION_MESSAGE,
	PASSWORD_LOWERCASE,
	PASSWORD_LOWERCASE_MESSAGE,
	PASSWORD_NUMBER,
	PASSWORD_NUMBER_MESSAGE,
	PASSWORD_UPPERCASE,
	PASSWORD_UPPERCASE_MESSAGE
} from '$lib/features/user-management/config/passwordValidators'
import {
	MAX_USERNAME_SIZE,
	MIN_USERNAME_SIZE
} from '$lib/features/user-management/config/usernameSize'

const signupSchema = z
	.object({
		username: z.string().min(MIN_USERNAME_SIZE).max(MAX_USERNAME_SIZE),
		password: z
			.string()
			.min(MIN_PASSWORD_SIZE)
			.max(MAX_PASSWORD_SIZE)
			.refine(PASSWORD_UPPERCASE, PASSWORD_UPPERCASE_MESSAGE)
			.refine(PASSWORD_LOWERCASE, PASSWORD_LOWERCASE_MESSAGE)
			.refine(PASSWORD_NUMBER, PASSWORD_NUMBER_MESSAGE),
		confirmPassword: z.string(),
		email: z.string().email()
	})
	.refine(PASSWORD_CONFIRM_VALIDATION, PASSWORD_CONFIRM_VALIDATION_MESSAGE)

export const load: PageServerLoad = async ({ locals }) => {
	const session = await locals.auth.validate()

	if (session) {
		if (!session.user.emailVerified) throw redirect(302, '/email-verification')
		throw redirect(302, '/')
	}

	return {}
}

export const actions = {
	register: async ({ request }) => {
		const form = await superValidate(request, signupSchema)

		if (!form.valid) {
			const usernameError = findErrorByName(form.errors, 'username')
			const passwordError = findErrorByName(form.errors, 'password')
			const passwordConfirmError = findErrorByName(
				form.errors,
				'confirmPassword'
			)
			const emailError = findErrorByName(form.errors, 'email')

			return fail(400, {
				errors: {
					usernameError,
					passwordError,
					passwordConfirmError,
					emailError
				},
				incorrect: true
			})
		}

		const usernameExists = await verifyUniqueUsername(form.data.username)

		if (usernameExists) {
			return fail(400, {
				duplicatedUsername: true
			})
		}

		try {
			const user = await auth.createUser({
				key: {
					providerId: 'email',
					providerUserId: form.data.email.toLowerCase(),
					password: form.data.password
				},
				attributes: {
					username: form.data.username,
					email: form.data.email.toLowerCase(),
					email_verified: false
				}
			})

			const token = await generateEmailVerificationToken(user.userId)

			await sendEmailVerificationLink(token, {
				username: form.data.username,
				email: form.data.email
			})
		} catch (e) {
			let message

			if (e instanceof LuciaError) {
				message = e.message
			}

			if (message === 'AUTH_DUPLICATE_KEY_ID') {
				return fail(400, {
					duplicatedEmail: true
				})
			}
		}

		throw redirect(302, `/email-verification/${form.data.username}`)
	}
} satisfies Actions
