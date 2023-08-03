import {ThreadId} from '#/app/def';
import {yw_navigator} from '#/app/mem';
import ScanQr from '#/app/screen/ScanQr.svelte';
import {open_flow} from '#/script/msg-flow';
import {B_ANDROID_NATIVE, B_IOS_WEBKIT, B_WITHIN_PWA} from '#/share/constants';
import {microtask, timeout_exec} from '#/util/belt';

export async function launch_qr_scanner(): Promise<void> {
	if(B_WITHIN_PWA || B_IOS_WEBKIT || B_ANDROID_NATIVE) {
		const k_navigator = yw_navigator.get();

		// activate scratch thread
		await k_navigator.activateThread(ThreadId.SCRATCH);

		// reset the thread in case something else was using the scratch space
		k_navigator.activeThread.reset();

		await microtask();

		// push qr code scanner
		k_navigator.activePage.push({
			creator: ScanQr,
			props: {
				exittable: true,
			},
		});
	}
	else {
		// open qr code scanner
		await timeout_exec(4e3, () => open_flow({
			flow: {
				type: 'scanQr',
				value: {
					id: 'side_menu',
				},
				page: null,
			},
			open: {
				popout: true,
			},
		}));
	}
}
