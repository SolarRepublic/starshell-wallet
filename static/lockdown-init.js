// freeze all intrinsic values
lockdown({
	consoleTaming: 'unsafe',
	errorTaming: 'unsafe',
	mathTaming: 'unsafe',
	dateTaming: 'unsafe',
	overrideTaming: 'severe',
});
