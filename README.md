# Full-Stack Disk Space Analyzer

A simple web application built with Python/Flask and vanilla JavaScript to analyze disk space usage on your local machine. It provides a user-friendly interface to navigate directories and identify which subfolders and files are consuming the most space.

*<!-- TODO: Replace the placeholder URL above with an actual screenshot of your running application! -->*

## ✨ Features

*   **Directory Analysis:** Enter a path on your local machine to scan its contents.
*   **Size Breakdown:** Displays the size of immediate subdirectories and files within the selected path, sorted largest first.
*   **Human-Readable Sizes:** Shows sizes in KB, MB, GB, etc.
*   **Web Interface:** Clean UI built with HTML, Bootstrap 5, and JavaScript.
*   **Navigation:**
    *   Clickable directory names to navigate deeper into the file system.
    *   "Up" button to navigate to the parent directory.
*   **Session Caching:**
    *   Avoids re-scanning already analyzed directories within a named session using browser `localStorage`.
    *   Create/name new sessions.
    *   Load previously saved sessions from a dropdown.
    *   Clear the active session's cache.
    *   Delete specific saved sessions.
*   **Refresh Option:** Force a re-scan of the current directory, bypassing the cache.
*   **Log Viewing:** Displays basic logs and warnings from the backend scan process (e.g., permission errors on sub-items) in the UI.
*   **Loading Indicator:** Shows progress indication during analysis.
*   **Error Handling:** Basic handling for non-existent paths, permission errors, etc.

## 🛠️ Technologies Used

*   **Backend:** Python 3, Flask
*   **Frontend:** HTML5, CSS3 (Bootstrap 5), JavaScript (Vanilla JS, Fetch API, LocalStorage)
*   **Python Libraries:** `os`, `pathlib`

## 🚀 Setup and Running Locally

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/disk-analyzer.git
    cd disk-analyzer
    ```
    *(Replace `your-username` with your actual GitHub username)*

2.  **Install dependencies:** (Only Flask is required for the basic backend)
    ```bash
    pip install Flask
    ```
    *(Consider creating a `requirements.txt` for more complex projects)*

3.  **Run the Flask backend:**
    ```bash
    python app.py
    ```
    The backend server will start, typically on `http://127.0.0.1:5000`.

4.  **Access the application:**
    Open your web browser and navigate to `http://127.0.0.1:5000`.

## 📖 Usage

1.  **Session Management (Optional but Recommended):**
    *   Enter a name (e.g., `MyDocumentsScan`) in the "New/Use Name" input and click "Use / Start" to begin caching results.
    *   Alternatively, select a previously saved session from the dropdown and click "Load".
2.  **Enter Path:** Input the full path of the directory you want to analyze (e.g., `C:\Users\YourUser\Documents` or `/home/youruser/projects`).
3.  **Analyze:** Click the "Analyze" button. If using a session and the path has been analyzed before in that session, it will load from the cache. Otherwise, it fetches data from the backend.
4.  **Refresh:** Click the "Refresh" button to force a re-scan from the backend, ignoring the cache for the current path and updating the cache afterwards.
5.  **Navigate:**
    *   Click on underlined directory names in the results table to navigate into them.
    *   Click the "Up" button to go to the parent directory.
6.  **View Logs:** Check the "Analysis Logs" section for any warnings or errors encountered by the backend during the scan.

## ⚠️ Important Considerations

*   **SECURITY:** **This application is intended for local use ONLY.** The backend currently allows scanning any directory the user running the `python app.py` process has access to. **Do NOT expose this application directly to the internet without significant security hardening**, including:
    *   Robust path validation and sandboxing (preventing access outside allowed directories).
    *   Running the backend process with minimal necessary privileges.
    *   Adding proper authentication and authorization.
*   **PERFORMANCE:** Scanning very large directories or network drives can take a significant amount of time and consume server resources. The frontend might appear unresponsive during very long scans.
*   **ERROR HANDLING:** Error handling is basic. Permission errors on the *top-level* directory being scanned will prevent listing, while errors on sub-items will be noted but allow the rest of the scan to proceed.
*   **PLATFORM:** Developed primarily on `[Your OS, e.g., Linux/Windows]`. It uses `pathlib` and standard libraries, aiming for cross-platform compatibility, but extensive testing on all OS variations has not been performed. *(Remember to replace the placeholder OS)*

## 🌱 Future Improvements (Ideas)

*   Implement asynchronous scanning on the backend (e.g., using Celery or asyncio) for better responsiveness with large directories.
*   Add visualizations (e.g., treemaps, bar charts) using libraries like Chart.js or D3.js.
*   More granular progress indicators.
*   Optionally store the last viewed path within a session for automatic loading.
*   More robust error reporting and handling.
*   [DANGEROUS] Add functionality to delete files/folders (Requires extreme caution and confirmation).

## 📄 License

This project is licensed under the terms of the **GNU General Public License v3.0**.

You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.

The full license text is also included in the `LICENSE` file in the root of this repository.
