const OPENAI_API_KEY = '***';
const OPENAI_URL = '***';

export function Prompt(folders, bookmarks) {
    const bookmarkList = bookmarks
        .map((bookmark, index) => `${index + 1}. ${bookmark.title}: ${bookmark.url}`)
        .join('\n');

    return `Your goal is to help me organize scattered bookmarks into appropriate folders.

My bookmark folder structure:
${folders}

Uncategorized bookmarks:
${bookmarkList}

Please suggest placing each uncategorized bookmark into the most suitable folder based on its content and title. If none of the existing folders are suitable, you can suggest creating a new folder.
For each bookmark, please provide your suggestion using the following JSON format:

{
    "1": "Suggested folder name",
    "2": {"name": "New folder name", "new": true},
    "3": "Suggested folder name"
    ...
}

Notes:
1. The numeric keys correspond to the bookmark numbers.
2. If suggesting a new folder, please use the object format including "name" and "new" fields.
3. Ensure your suggestions are concise and consistent with the existing folder structure.
4. Use a format like "A/B/C" to distinguish folder hierarchy levels.
5. Only return the JSON object, do not include any other explanatory text.`;
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