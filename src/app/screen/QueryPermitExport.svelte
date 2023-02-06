<script lang="ts">
	import type {AminoMsg} from '@cosmjs/amino';
	import type {Any} from '@solar-republic/cosmos-grpc/dist/google/protobuf/any';
	
	import type {AccountPath, AccountStruct} from '#/meta/account';
	import type {AppStruct} from '#/meta/app';
	import type {Bech32, ChainStruct, ContractStruct} from '#/meta/chain';
	import type {SecretPath, SecretStruct} from '#/meta/secret';
	import {Snip24} from '#/schema/snip-24-const';
	import type {Snip24Permission} from '#/schema/snip-24-def';
	import {Snip2xMessageConstructor} from '#/schema/snip-2x-const';
	
	import {onDestroy, onMount} from 'svelte';
	
	import {Screen, Header} from './_screens';
	import {yw_network} from '../mem';
	
	import type {SecretNetwork} from '#/chain/secret-network';
	import {subscribe_store} from '#/store/_base';
	import {Accounts} from '#/store/accounts';
	import {Apps, G_APP_STARSHELL} from '#/store/apps';
	import {Chains} from '#/store/chains';
	import {Contracts} from '#/store/contracts';
	import {Secrets} from '#/store/secrets';
	import {ode} from '#/util/belt';
	
	import {buffer_to_base58} from '#/util/data';
	
	import QueryPermitEdit from './QueryPermitEdit.svelte';
	import RequestSignature from './RequestSignature.svelte';
	import type {Actions} from '../frag/Portrait.svelte';
	import Portrait from '../frag/Portrait.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Copyable from '../ui/Copyable.svelte';
	import Curtain from '../ui/Curtain.svelte';
	import Field from '../ui/Field.svelte';
	import Fields from '../ui/Fields.svelte';
	import PasswordField from '../ui/PasswordField.svelte';
	import Row from '../ui/Row.svelte';
	import Spacer from '../ui/Spacer.svelte';
	import Tooltip from '../ui/Tooltip.svelte';
	
	import SX_ICON_BAN from '#/icon/ban.svg?raw';
	import SX_ICON_EXPAND from '#/icon/expand.svg?raw';
	
	
	export let permit: SecretStruct<'query_permit'>;
	
	const a_permissions = (() => {
		const a_original = permit.permissions;
		const a_sorted: Snip24Permission[] = [];

		for(const si_permission of Snip24.PERMISSIONS) {
			const i_original = a_original.indexOf(si_permission);

			if(i_original >= 0) {
				a_sorted.push(si_permission);
				a_original.splice(i_original, 1);
			}
		}

		return [...a_sorted, ...a_original];
	})();

	const s_permissions = a_permissions.slice(0, -1).join(', ')+(a_permissions.length > 1? ' and '+a_permissions.at(-1): '');

	const s_password_export = buffer_to_base58(crypto.getRandomValues(new Uint8Array(10)));

	const b_disabled = true;

	function download_permit() {

	}
</script>

<style lang="less">
	.chain-account {
		display: flex;

		>* {
			flex: auto;
		}
	}

	.actions {
		color: var(--theme-color-primary);
	}

	.permissions {
		display: flex;
		justify-content: space-between;
	}
</style>

<Screen slides>
	<Header title='Query Permit' subtitle={s_header_subtitle} pops search />

	<h3>
		Export Query Permit
	</h3>

	<p>
		Exporting this permit to a file allows you to share your token's up-to-date <b>{s_permissions}</b> viewing permission{1 === a_permissions.length? '': 's'} with other parties.
	</p>

	<p>
		Make sure to trust whoever you share this permit with, since they will be able to share it with others.
	</p>

	<p>
		You can revoke this permit any time, preventing those you shared it with from viewing the latest changes to your token data.
	</p>

	<h3>
		Generate File Password
	</h3>

	<p>
		The exported file will be encrypted using a cryptographically random password.
	</p>
		
	<p>
		Copy and share this password with the recipient. It's best to do this separately from sharing the file.
		For example, send the file to them over email, but send the password via instant message.
	</p>

	<PasswordField password={s_password_export} label="Generated Password" />

	<ActionsLine cancel confirm={['Download', () => download_permit(), b_disabled]} />
</Screen>
