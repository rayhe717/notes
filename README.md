## Local Notes → Study Materials

Local‑first web app that turns your rough psychology notes into structured academic study materials using the DeepSeek API.

### Features

- **Local file handling**: Notes stay on your device (supports `.txt` and `.md`).
- **Folder selection**: Use the File System Access API to select an entire folder of notes.
- **Manual uploads**: Upload individual files via a standard file picker.
- **Rescan**: Refreshes the current folder to pick up new or changed files.
- **DeepSeek integration**: Generates:
  - Review Sheet (master’s‑level notes)
  - One‑Page Study Sheet
  - Text‑Based Concept Map
- **Markdown rendering**: Outputs are rendered as formatted HTML with tabs for each output type.
- **Download as Markdown**: Export any generated view as a `.md` file.
- **Local‑first**: Only extracted text is sent to DeepSeek when you explicitly process files.

### Prerequisites

- Node.js (18+ recommended)
- npm (or pnpm / yarn if you prefer and adjust commands accordingly)

### 1. Install dependencies

```bash
cd /Users/asteray/Downloads/cursor-notes
npm install
```

### 2. Configure the DeepSeek API key (direct from browser)

For simplicity, the default setup calls DeepSeek **directly from the browser**.
This is fine for **personal, local use**, but it means your key is bundled in the frontend.

Open `src/deepseekClient.js` and set:

```js
export const DEEPSEEK_API_KEY = "sk-your-key-here";
```

> If your browser or network blocks direct calls (CORS/network policy), you can
> instead run `server.js` as a tiny local proxy and point the frontend at it,
> but that’s optional and not required for basic local testing.

### 3. Run the app locally

```bash
cd /Users/asteray/Downloads/cursor-notes
npm run dev
```

Then open the printed local URL in your browser (typically `http://localhost:5173`).

### 4. Usage

1. **Load notes**
   - Click **Select Folder** to choose a directory of `.txt` / `.md` files (supported in Chromium‑based browsers and some others).
   - Or click **Upload File** to add individual files.
2. **Choose outputs**
   - In the control panel, tick one or more output types:
     - Review Sheet
     - One‑Page Study Sheet
     - Text‑Based Concept Map
3. **Process**
   - Click **Process All** to send extracted text to DeepSeek and generate the selected outputs for each file.
   - Progress and per‑file errors are displayed in the file list.
4. **Inspect results**
   - Click any file in the list.
   - Use the tabs in the preview panel to switch between:
     - Review Sheet
     - Study Sheet
     - Concept Map
5. **Download**
   - In the preview header, use the **Download \*.md** buttons to save the currently generated views for the selected file.

### Offline and privacy behavior

- **Offline use**: The UI and file handling work offline. DeepSeek calls will fail gracefully if there is no network.
- **Local‑first**:
  - Source files never leave your machine.
  - Only the extracted text you choose to process is sent to DeepSeek.
  - No background uploads, no database, no server.

### Notes

- PDF support is intentionally omitted in this MVP to keep the implementation lightweight and fully client‑side. You can extend `src/App.jsx` to add a PDF text extraction step (for example, via `pdfjs-dist`) if needed.
- The app uses React + Vite with modern ES modules and a small dependency set for clarity and simplicity.

