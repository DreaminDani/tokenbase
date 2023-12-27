import { db } from '$lib/db'
import { workspaceMember } from '$lib/db/schema'

export const addMemberToWrokspace = async (
	userId: string,
	workspaceId: string
) => {
	await db.insert(workspaceMember).values({ userId, workspaceId })
}
