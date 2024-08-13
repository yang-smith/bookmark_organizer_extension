import { AI_Chat, Prompt } from "./ai.js";

let bookmarkGroups = [];
// let suggestions = {};
let processedCount = 0;
let totalCount = 0;
let bookmarks;

let bookmarkMap = new Map(); 
let suggestions = new Map(); 

document.addEventListener('DOMContentLoaded', function () {
    
    document.title = chrome.i18n.getMessage("appName");
    document.querySelector('h1').textContent = chrome.i18n.getMessage("appName");
    document.querySelector('#ctaButton').textContent = chrome.i18n.getMessage("organizeButton");
    document.querySelector('#applyChanges').textContent = chrome.i18n.getMessage("applyChanges");
    document.querySelector('#loader p').textContent = chrome.i18n.getMessage("organizing");
    document.querySelector('#results h2').textContent = chrome.i18n.getMessage("suggestionsTitle");
    document.querySelectorAll('#resultTable th')[1].textContent = chrome.i18n.getMessage("bookmarkName");
    document.querySelectorAll('#resultTable th')[2].textContent = chrome.i18n.getMessage("suggestedFolder");
  

    var organizeButton = document.getElementById('ctaButton');
    var loader = document.getElementById('loader');
    var results = document.getElementById('results');
    var resultList = document.getElementById('resultList');
    var applyChangesButton = document.getElementById('applyChanges');
    applyChangesButton.classList.add('hidden');


    organizeButton.addEventListener('click', processBookmarks);

    var selectAllCheckbox = document.getElementById('selectAll');
    var applyChangesButton = document.getElementById('applyChanges');

    selectAllCheckbox.addEventListener('change', function () {
        var checkboxes = document.querySelectorAll('#resultList input[type="checkbox"]');
        checkboxes.forEach(checkbox => checkbox.checked = this.checked);
    });

    applyChangesButton.addEventListener('click', function () {
        var selectedBookmarks = [];
        var checkboxes = document.querySelectorAll('#resultList input[type="checkbox"]:checked');
        checkboxes.forEach(checkbox => {
            let bookmarkId = checkbox.dataset.id;
            let bookmark = bookmarkMap.get(bookmarkId);
            let suggestion = suggestions.get(bookmarkId);
            let suggestedFolder = typeof suggestion === 'object' ? suggestion.name : suggestion;
            selectedBookmarks.push({
                id: bookmarkId,
                title: bookmark.title,
                url: bookmark.url,
                suggestedFolder: suggestedFolder
            });
        });
    
        if (selectedBookmarks.length > 0) {
            applyBookmarkChanges(selectedBookmarks);
        } else {
            alert('请选择至少一个书签来应用更改。');
        }
    });
});

function extractJsonFromString(str) {
    try {
        let match = str.match(/\{[\s\S]*\}/);
        if (match) {
            return JSON.parse(match[0]);
        }
    } catch (error) {
        console.error("解析 JSON 时出错:", error);
    }
    return null;
}

function displayError(message) {
    var resultList = document.getElementById('resultList');
    resultList.innerHTML = `<p class="error-message">${message}</p>`;
}


// 将书签分组的函数
function splitBookmarksIntoGroups(bookmarks, groupSize = 30) {
    let groups = [];
    for (let i = 0; i < bookmarks.length; i += groupSize) {
        groups.push(bookmarks.slice(i, i + groupSize));
    }
    return groups;
}


// 更新进度 UI 的函数
function updateProgressUI() {
    document.getElementById('progress').textContent = `已处理 ${processedCount} / ${totalCount} 个书签`;
}

// 处理单个组的函数
async function processBookmarkGroup(group) {
    let folderStructure = await new Promise(resolve => getBookmarkFolderStructure(resolve));
    let prompt = Prompt(folderStructure, group);
    console.log(prompt);
    let result = await AI_Chat(prompt, 'gpt-4o-mini');
    console.log(result);
    let jsonResult = extractJsonFromString(result);
    if (jsonResult) {
        let idMappedResult = {};
        group.forEach((bookmark, index) => {
            idMappedResult[bookmark.id] = jsonResult[index + 1];
        });
        console.log(idMappedResult);
        displayResults(group, idMappedResult);
        // displayResults(group, jsonResult);
        processedCount += group.length;
        updateProgressUI();
    } else {
        displayError("无法解析 AI 返回的结果。请重试。");
    }
}

// 主要的处理函数
async function processBookmarks() {
    const organizeButton = document.getElementById('ctaButton');
    organizeButton.classList.add('hidden');
    loader.classList.remove('hidden');
    results.classList.add('hidden');
    resultList.innerHTML = '';

    bookmarks = await new Promise(resolve => getUncategorizedBookmarks(resolve));
    bookmarkGroups = splitBookmarksIntoGroups(bookmarks);
    totalCount = bookmarks.length;
    processedCount = 0;
    
    try {
        await Promise.all(bookmarkGroups.map(processBookmarkGroup));
    } catch (error) {
        console.error("处理书签组时发生错误:", error);
        displayError("处理书签时发生错误，请重试。");
    }
    
    loader.classList.add('hidden');
    results.classList.remove('hidden');
    document.getElementById('applyChanges').classList.remove('hidden');
    updateProgressUI();
}




function displayResults(bookmarks, newSuggestions) {
    resultList.innerHTML = ''; // 清空现有的结果列表
    bookmarks.forEach((bookmark) => {
        bookmarkMap.set(bookmark.id, bookmark);
        let suggestion = newSuggestions[bookmark.id];
        suggestions.set(bookmark.id, suggestion);
        let isNewFolder = typeof suggestion === 'object' && suggestion.new;

        let row = resultList.insertRow();
        
        let checkCell = row.insertCell(0);
        let checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.id = bookmark.id;
        checkCell.appendChild(checkbox);

        let nameCell = row.insertCell(1);
        nameCell.textContent = bookmark.title;

        let folderCell = row.insertCell(2);
        folderCell.textContent = isNewFolder ? suggestion.name : suggestion;
        if (isNewFolder) {
            folderCell.classList.add('new-folder');
        }
    });
}




function getUncategorizedBookmarks(callback) {
    chrome.bookmarks.getTree(function (bookmarkTreeNodes) {
        let uncategorizedBookmarks = [];

        function traverseBookmarks(nodes) {
            for (let node of nodes) {
                if (node.id === '0') {
                    traverseBookmarks(node.children);
                } else if (node.id === '1' || node.id === '2') {
                    for (let child of node.children || []) {
                        if (child.url) {
                            uncategorizedBookmarks.push({
                                id: child.id,
                                title: child.title,
                                url: child.url
                            });
                        }
                    }
                }
            }
        }

        traverseBookmarks(bookmarkTreeNodes);
        callback(uncategorizedBookmarks);
    });
}


function getBookmarkFolderStructure(callback) {
    chrome.bookmarks.getTree(function (bookmarkTreeNodes) {
        let folderStructure = '';

        function traverseBookmarks(nodes, depth = 0) {
            for (let node of nodes) {
                if (node.id === '1' || node.id === '2') {
                    if (node.children) {
                        traverseBookmarks(node.children, depth);
                    }
                } else if (node.children) {
                    folderStructure += '  '.repeat(depth) + node.title + '\n';
                    traverseBookmarks(node.children, depth + 1);
                }
            }
        }

        traverseBookmarks(bookmarkTreeNodes);

        folderStructure = folderStructure.split('\n').filter(line => line.trim() !== '').join('\n');

        callback(folderStructure);
    });
}

function applyBookmarkChanges(selectedBookmarks) {
    let successCount = 0;
    let errorCount = 0;

    Promise.all(selectedBookmarks.map(bookmark => moveBookmarkToFolder(bookmark)))
        .then(results => {
            results.forEach(result => {
                if (result.success) {
                    successCount++;
                } else {
                    errorCount++;
                    console.error(`移动书签 "${result.bookmark.title}" 失败: ${result.error}`);
                }
            });
            alert(`操作完成。成功移动 ${successCount} 个书签，失败 ${errorCount} 个。`);
            location.reload(); // 刷新页面以更新显示
        })
        .catch(error => {
            console.error('处理书签时发生错误:', error);
            alert('处理书签时发生错误，请查看控制台获取详细信息。');
        });
}

function moveBookmarkToFolder(bookmark) {
    return new Promise((resolve) => {
        const folderPath = bookmark.suggestedFolder.split('/').filter(f => f.trim() !== '');
        
        chrome.bookmarks.getChildren('1', (bookmarkBarContents) => {
            if (chrome.runtime.lastError) {
                resolve({ success: false, error: '无法访问书签栏', bookmark });
                return;
            }
            
            createFolderPath('1', folderPath, 0);
        });

        function createFolderPath(parentId, folders, index) {
            if (index >= folders.length) {
                chrome.bookmarks.move(bookmark.id, { parentId: parentId }, (result) => {
                    if (chrome.runtime.lastError) {
                        resolve({ success: false, error: chrome.runtime.lastError.message, bookmark });
                    } else {
                        resolve({ success: true, bookmark });
                    }
                });
                return;
            }

            chrome.bookmarks.getChildren(parentId, (children) => {
                const existingFolder = children.find(child => child.title === folders[index] && !child.url);
                if (existingFolder) {
                    createFolderPath(existingFolder.id, folders, index + 1);
                } else {
                    chrome.bookmarks.create({ parentId: parentId, title: folders[index] }, (newFolder) => {
                        if (chrome.runtime.lastError) {
                            resolve({ success: false, error: chrome.runtime.lastError.message, bookmark });
                        } else {
                            createFolderPath(newFolder.id, folders, index + 1);
                        }
                    });
                }
            });
        }
    });
}

