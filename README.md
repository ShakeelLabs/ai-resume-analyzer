# AI Resume Analyzer

AI-powered resume analysis for ATS scoring, job matching, keywords, skills and resume improvement.

## Features

- Resume upload: PDF, DOCX and TXT
- ATS-style resume score
- Job description matching
- Keyword coverage and missing keyword detection
- Skill detection
- Resume quality signals
- Practical improvement suggestions
- Local AI semantic matching in the browser
- No account or paid API required for the core analyzer

## How It Works

Resume text is extracted in the browser. Traditional ATS-style checks are combined with a lightweight local sentence-embedding model for semantic comparison against a supplied job description.

## Privacy

Resume content is processed in the browser. The project does not require a backend or an account for analysis.

The first semantic analysis may download the AI model to the browser cache.

## Tech Stack

- HTML
- CSS
- JavaScript
- PDF.js
- Mammoth.js
- Transformers.js
- Hugging Face Xenova/all-MiniLM-L6-v2

## Local Development

Serve the repository with any static web server. ES modules and browser security rules mean opening index.html directly with a file URL is not recommended.

## License

MIT License
