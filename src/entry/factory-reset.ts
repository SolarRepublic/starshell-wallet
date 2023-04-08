import {factory_reset} from '#/share/auth';

// wait for DOM
window.addEventListener('DOMContentLoaded', () => {
	// select dom-log
	const dm_log = document.querySelector('section#dom-log');

	// hide dom log
	if(dm_log) {
		(dm_log as HTMLElement).style.opacity = '0';

		// show it shortly
		setTimeout(() => {
			(dm_log as HTMLElement).style.opacity = '1';
		}, 2e3);
	}

	// bind reload button
	document.getElementById('reload')?.addEventListener('click', () => {
		location.reload();
	});

	// bind factory reset button
	document.getElementById('factory-reset')?.addEventListener('click', async() => {
		const s_confirmation = window.prompt([
			'This action will permanently delete all data and settings. It cannot be undone.',
			'Type "DELETE ALL" below to continue.',
		].join('\n'));

		if('DELETE ALL' === s_confirmation?.replace(/^\s*['"]?|['"]?\s*$/g, '').toUpperCase()) {
			await factory_reset();
			location.reload();
		}
	});

	// enable the button after a few seconds
	setTimeout(() => {
		document.getElementById('factory-reset')?.removeAttribute('disabled');
	}, 2e3);
});
