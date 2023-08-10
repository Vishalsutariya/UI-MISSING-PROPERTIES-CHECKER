import fetch from 'node-fetch';

const repoOwner = 'QQyrus';
const repoName = 'ui-configuration';
const accessToken = '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';

// Folders to compare (excluding the base folder)
const foldersToCompare = ['prod-ui-config', 'qyrus-ui-config']; // Add more folders as needed

// Base folder (for comparison)
const baseFolder = 'stg-ui-config';

async function fetchFileContent(filePath) {
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;

    const response = await fetch(apiUrl, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });


    if (!response.ok) {
        // console.error(response);
        throw new Error(`Failed to fetch ${filePath}`);
    }

    const data = await response.json();
    const fileContentResponse = await fetch(data.download_url);
    const fileContent = await fileContentResponse.text();
    // console.log(fileContent);
    return fileContent;
}

function compareEnvironments(baseContent, otherContent) {
    const baseEnv = requireFromString(baseContent);
    const otherEnv = requireFromString(otherContent);

    const missingProperties = [];

    for (const property in baseEnv) {
        if (!(property in otherEnv)) {
            missingProperties.push(property);
        }
    }

    return missingProperties;
}

function requireFromString(code) {
    const Module = module.constructor;
    const m = new Module();
    m._compile(code, 'module.js'); // Compile the code as a CommonJS module
    return m.exports;
}

async function main() {
    for (const folder of foldersToCompare) {
        try {
            const baseFileContent = await fetchFileContent(`${baseFolder}/environment.prod.ts`);
            const otherFileContent = await fetchFileContent(`${folder}/environment.prod.ts`);

            const missingProperties = compareEnvironments(baseFileContent, otherFileContent);
            console.log(`Missing properties in ${folder}:`, missingProperties);

        } catch (error) {
            console.error(`Error comparing ${folder}:`, error.message);
        }
    }
}

main();