import * as vscode from 'vscode'
import {TimelineFactory, TimelineType, Timeline} from './twitter'

function doInsert(doc: vscode.TextDocument, editor: vscode.TextEditor, content: string): Thenable<void> {
	return editor.edit((builder) => {
		builder.insert(new vscode.Position(0, 0), content);
	}).then(applied => {
		vscode.commands.executeCommand("workbench.action.markdown.togglePreview");
		console.log('Done');
	}, (error) => {
		console.error('edit failed: ');
		console.error(error);
		vscode.window.showErrorMessage('Twitter failed to initialize. Please run command \'Reload Window\' to fix it.');
	});
}

function doDeleteAndInsert(range: vscode.Range, doc: vscode.TextDocument, editor: vscode.TextEditor, content: string): Thenable<void> {
	return editor.edit((builder) => {
		builder.delete(range);
	}).then(applied => {
		doInsert(doc, editor, content);
	}, error => {
		console.error('edit failed: ');
		console.error(error);
		vscode.window.showErrorMessage('Twitter failed to initialize. Please run command \'Reload Window\' to fix it.');
	})
}

function getNewInTimeline(message: string, timeline: Timeline) {
	vscode.window.setStatusBarMessage(message,
		timeline.getNew().then((content) => {
			const filename = timeline.filename;
			console.log('Twitter buffer file: ' + filename);
			vscode.workspace.openTextDocument(filename).then((doc) => {
				TimelineFactory.shouldTogglePreview[doc.fileName] = false;
				console.log('doc opened');
				vscode.window.showTextDocument(doc).then((editor) => {
					console.log('editing begins');
					const start = doc.lineAt(0).range.start;
					const end = doc.lineAt(doc.lineCount - 1).range.end;
					console.log(start);
					console.log(end);
					var needClear = false;
					if (start.compareTo(end) < 0) {
						needClear = true;
					}
					if (needClear) {
						doDeleteAndInsert(new vscode.Range(start, end), doc, editor, content).then(() => {
							TimelineFactory.shouldTogglePreview[doc.fileName] = true;
							TimelineFactory.statusBarItemRefresh.show();
							TimelineFactory.refreshTargetTimeline = timeline;
						});;
					} else {
						doInsert(doc, editor, content).then(() => {
							TimelineFactory.shouldTogglePreview[doc.fileName] = true;
							TimelineFactory.statusBarItemRefresh.show();
							TimelineFactory.refreshTargetTimeline = timeline;
						});	
					}
				}, (error) => {
					console.error('showTextDocument failed: ' + error);
				});
			}, (error) => {
				console.error('openTextDocument failed: ' + error);
			});
		}, (error: string) => {
			vscode.window.showErrorMessage('Failed to retrieve timeline: ' + error);
		})
	);
}

function refreshTimeline(type: TimelineType) {
	const timeline = TimelineFactory.getTimeline(type);
	getNewInTimeline('Refreshing timeline...', timeline);
}

export function twitterStart() {
	// Display a message box to the user
	const timeline = TimelineType.Home;
	refreshTimeline(timeline);
}

export function twitterTimeline() {
	const timelines = [
		{ label: 'Home', description: 'Go to the Home Timeline', type: TimelineType.Home },
		{ label: 'User', description: 'Go to the User Timeline', type: TimelineType.User },
		{ label: 'Search', description: 'Search Twitter', type: TimelineType.Search },
		{ label: 'Post', description: 'Post your status to Twitter', type: TimelineType.Post },
	];
	vscode.window.showQuickPick(timelines).then((v) => {
		console.log('Type: ' + v.type + ' selected');
		switch(v.type) {
			case TimelineType.Home:
			case TimelineType.User:
				refreshTimeline(v.type);
				break;
			case TimelineType.Search:
				twitterSearch();
				break;
			case TimelineType.Post:
				twitterPost();
				break;
		}
	});
}

export function twitterSearch() {
	TimelineFactory.getTimeline(TimelineType.Home).getTrends().then(trends => {
		vscode.window.showInputBox({
			placeHolder: 'Search Twitter',
			prompt: 'Trends: ' + trends
		}).then(value => {
			if (value) {
				console.log('Searching for ' + value);
				const timeline = TimelineFactory.getSearchTimeline(value);
				getNewInTimeline('Searching for ' + value + ' ...', timeline);
			}
		});
	}, error => {
		vscode.window.showInputBox({
			placeHolder: 'Search Twitter',
			prompt: 'Search Twitter'
		}).then(value => {
			if (value) {
				console.log('Searching for ' + value);
				const timeline = TimelineFactory.getSearchTimeline(value);
				getNewInTimeline('Searching for ' + value + ' ...', timeline);
			}
		});
	});	
}

export function twitterPost() {
	vscode.window.showInputBox({
		placeHolder: 'What\'s happening?',
		prompt: 'Post your status to Twitter. '
	}).then(value => {
		if (value) {
			console.log("Posting... " + value);
			vscode.window.setStatusBarMessage('Posting status...',
				TimelineFactory.getTimeline(TimelineType.Home).post(value).then(result => {
					vscode.window.showInformationMessage('Your status was posted.');
				}, (error) => {
					vscode.window.showErrorMessage('Failed to post the status: ' + error);
				})
			);
		}
	});
}

export function twitterRefresh() {
	const timeline = TimelineFactory.refreshTargetTimeline;
	if (timeline) {		
		getNewInTimeline('Refreshing timeline...', timeline);
	}
}