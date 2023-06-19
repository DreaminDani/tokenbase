import type { IToken } from '../features/token-groups-store/types/token-interface'
import type { Group } from '../features/token-groups-store/types/group-interface'

const findTokenById = (
	tokenId: string,
	groups: Group[]
): IToken | undefined => {
	let foundToken: IToken | undefined = undefined

	for (const group of groups) {
		const token = group.tokens.find((token) => token.id === tokenId)
		if (token) {
			foundToken = token
			break
		}
	}

	return foundToken
}

export default findTokenById
