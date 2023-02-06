
addEventListener('DOMContentLoaded', () => {
	const sx_markdown = document.getElementById('content').textContent;

	const y_converter = new showdown.Converter({
		strikethrough: true,
		tables: true,
		ghCodeBlocks: true,
		tasklists: true,
		simpleLineBreaks: true,
		requireSpaceBeforeHeadingText: true,
		moreStyling: true,
		openLinksInNewWindow: true,
		backslashEscapesHTMLTags: true,
		underline: true,
	});

	y_converter.setFlavor('github');

	const sx_document = y_converter.makeHtml(JSON.parse(sx_markdown));

	document.body.innerHTML = sx_document;
});
