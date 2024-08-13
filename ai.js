
const OPENAI_API_KEY = '***'; 
const OPENAI_URL = '***'; 

export function Prompt(folders, bookmarks) {
    const bookmarkList = bookmarks
        .map((bookmark, index) => `${index + 1}. ${bookmark.title}: ${bookmark.url}`)
        .join('\n');

    return `你的目标是帮我将散落的书签放到合适的文件夹内。

我的书签文件夹结构:
${folders}

未分类的书签:
${bookmarkList}

请根据书签的内容和标题，建议将每个未分类的书签放入最合适的文件夹。如果现有文件夹都不合适，可以建议创建新的文件夹。
对于每个书签，请给出建议并使用以下JSON格式输出:

{
    "1": "建议的文件夹名称",
    "2": {"name": "新文件夹名称", "new": true},
    "3": "建议的文件夹名称"
    ...
}

注意事项：
1. 数字键对应书签的编号。
2. 如果建议创建新文件夹，请使用对象格式，包含"name"和"new"字段。
3. 确保你的建议简洁明了，并且与现有的文件夹结构保持一致。
4. 文件夹名称使用类似于“A/B/C”的方式区分层级
5. 只返回JSON对象，不要包含其他说明文字。`;
}


export async function AI_Chat(prompt, model) {
    try {

        const messages = [
            { "role": "system", "content": "you are a helpful assistant." },
            { "role": "user", "content": prompt }
        ];
        const AIResponse = await fetch(OPENAI_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: 0.1,
            }),
        });
        const data = await AIResponse.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('Error sending bookmarks to the API:', error);
    }
    return "fetch error"
}