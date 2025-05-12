import os
import platform
from flask import Flask, request, jsonify, render_template, abort
from pathlib import Path
import logging
import io # Not strictly needed with the current logging approach, but keep if needed later

# Configure basic console logging
# Log messages will appear in the terminal where you run `python app.py`
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(name)s - %(message)s'
)
# Get a logger instance for our app
log = logging.getLogger('disk_analyzer')

app = Flask(__name__)

# --- Helper Functions (get_size, human_readable_size) ---

def get_size(start_path='.', request_logs=None): # Pass log list
    """Calculates the size of a directory recursively."""
    total_size = 0
    try:
        # Use scandir for potentially better performance
        for entry in os.scandir(start_path):
            try:
                if entry.is_file(follow_symlinks=False):
                    try:
                        total_size += entry.stat(follow_symlinks=False).st_size
                    except (OSError, FileNotFoundError) as e:
                        msg = f"WARN: Could not get size for file: {entry.path} ({e})"
                        log.warning(msg)
                        if request_logs is not None: request_logs.append(msg)
                        continue # Skip files we can't access or that vanish
                elif entry.is_dir(follow_symlinks=False):
                    # Recursive call, handle potential errors within recursion
                    try:
                        # Pass the request_logs list down
                        total_size += get_size(entry.path, request_logs=request_logs)
                    except PermissionError:
                        msg = f"WARN: Permission denied scanning dir: {entry.path}"
                        log.warning(msg)
                        if request_logs is not None: request_logs.append(msg)
                        continue # Skip directories we can't access
                    except FileNotFoundError:
                        msg = f"WARN: Directory not found during scan: {entry.path}"
                        log.warning(msg)
                        if request_logs is not None: request_logs.append(msg)
                        continue # Skip directories that vanish
                    except OSError as e:
                        msg = f"WARN: OS Error scanning dir {entry.path}: {e}"
                        log.warning(msg)
                        if request_logs is not None: request_logs.append(msg)
                        continue # Skip directories with other OS errors
            except OSError as e: # Catch errors from is_file/is_dir itself (e.g. permissions)
                msg = f"WARN: Cannot access type/stat for entry: {entry.path} ({e})"
                log.warning(msg)
                if request_logs is not None: request_logs.append(msg)
                continue
    except PermissionError as e:
        msg = f"ERROR: Permission denied accessing base directory: {start_path} ({e})"
        log.error(msg)
        if request_logs is not None: request_logs.append(msg)
        raise # Re-raise to be caught by the caller
    except FileNotFoundError as e:
        msg = f"ERROR: Base directory not found: {start_path} ({e})"
        log.error(msg)
        if request_logs is not None: request_logs.append(msg)
        raise # Re-raise to be caught by the caller
    except OSError as e:
        msg = f"ERROR: OS error scanning base directory {start_path}: {e}"
        log.error(msg)
        if request_logs is not None: request_logs.append(msg)
        raise # Re-raise generic OS errors

    return total_size

def human_readable_size(size_bytes):
    """Converts bytes to a human-readable format."""
    if size_bytes is None:
        return "[Error]"
    if not isinstance(size_bytes, (int, float)) or size_bytes < 0:
        log.warning(f"Invalid size value encountered: {size_bytes}")
        return "[Invalid Size]"
    if size_bytes == 0:
        return "0 B"
    size_name = ("B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB")
    i = 0
    temp_size = float(size_bytes)
    while temp_size >= 1024 and i < len(size_name) - 1:
        temp_size /= 1024.0
        i += 1
    s = f"{temp_size:.2f}"
    if s.endswith(".00"): s = s[:-3]
    elif s.endswith("0"): s = s[:-1]
    return f"{s} {size_name[i]}"
# --- End Helper Functions ---


@app.route('/')
def index():
    """Serves the main HTML page."""
    default_path = str(Path.home())
    log.info("Serving index.html page")
    return render_template('index.html', default_path=default_path)

@app.route('/analyze', methods=['GET'])
def analyze_directory():
    """API endpoint to analyze a directory."""
    path_param = request.args.get('path')
    request_specific_logs = [] # List to hold logs for this request

    log.info(f"Received analysis request for path: '{path_param}'")
    request_specific_logs.append(f"INFO: Analysis request for: '{path_param}'")

    if not path_param:
        log.error("API Error: Missing 'path' parameter")
        request_specific_logs.append("ERROR: Missing 'path' parameter")
        return jsonify({"error": "Missing 'path' parameter", "logs": request_specific_logs}), 400

    target_path = None
    try:
        temp_path = Path(path_param)
        # Basic security check (less effective than full sandbox but better than nothing)
        if ".." in temp_path.parts:
             msg = f"WARN: Potential path traversal attempt detected in input: {path_param}"
             log.warning(msg)
             request_specific_logs.append(msg)
             # Abort early for obvious attempts
             # return jsonify({"error": "Invalid path specified (contains '..').", "logs": request_specific_logs}), 400

        target_path = temp_path.resolve(strict=False) # Resolve symlinks, get absolute path
        log.info(f"Resolved path to: {target_path}")
        request_specific_logs.append(f"INFO: Resolved path to: {target_path}")

        if not target_path.exists():
            msg = f"ERROR: Path does not exist: {target_path}"
            log.error(msg)
            request_specific_logs.append(msg)
            return jsonify({"error": f"Path does not exist: {target_path}", "path": str(target_path), "logs": request_specific_logs}), 404

        if not target_path.is_dir():
            msg = f"ERROR: Path is not a directory: {target_path}"
            log.error(msg)
            request_specific_logs.append(msg)
            return jsonify({"error": f"Path is not a directory: {target_path}", "path": str(target_path), "logs": request_specific_logs}), 400

    except PermissionError as e:
        msg = f"ERROR: Permission denied resolving/accessing path: {path_param} -> {target_path}. Error: {e}"
        log.error(msg)
        request_specific_logs.append(msg)
        return jsonify({"error": f"Permission denied accessing path '{path_param}'. Check server permissions.", "path": path_param, "logs": request_specific_logs}), 403
    except FileNotFoundError as e:
         msg = f"ERROR: Component of path '{path_param}' not found during resolution. Error: {e}"
         log.error(msg)
         request_specific_logs.append(msg)
         return jsonify({"error": f"Path or component not found: {path_param}", "path": path_param, "logs": request_specific_logs}), 404
    except OSError as e:
        msg = f"ERROR: OS error processing path '{path_param}'. Error: {e}"
        log.error(msg)
        request_specific_logs.append(msg)
        return jsonify({"error": f"Invalid path or OS error processing path: {e}", "path": path_param, "logs": request_specific_logs}), 400
    except Exception as e:
        msg = f"ERROR: Unexpected error processing path '{path_param}'. Error: {e}"
        log.exception(msg)
        request_specific_logs.append(msg)
        return jsonify({"error": f"An unexpected server error occurred processing the path: {e}", "path": path_param, "logs": request_specific_logs}), 500


    results = []
    total_scan_size = 0
    items_in_dir = 0
    scan_errors = 0

    log.info(f"Starting scan of directory contents: {target_path}")
    request_specific_logs.append(f"INFO: Starting scan of: {target_path}")

    try:
        dir_iterator = os.scandir(target_path)
    except PermissionError as e:
        msg = f"ERROR: Permission denied listing directory contents: {target_path}. Error: {e}"
        log.error(msg)
        request_specific_logs.append(msg)
        return jsonify({"error": f"Permission denied listing directory: {target_path}. Cannot list contents.", "path": str(target_path), "results": [], "logs": request_specific_logs}), 403
    except FileNotFoundError as e:
        msg = f"ERROR: Target directory vanished before scanning: {target_path}. Error: {e}"
        log.error(msg)
        request_specific_logs.append(msg)
        return jsonify({"error": f"Directory not found (vanished?): {target_path}", "path": str(target_path), "logs": request_specific_logs}), 404
    except OSError as e:
        msg = f"ERROR: OS error listing directory {target_path}: {e}"
        log.error(msg)
        request_specific_logs.append(msg)
        return jsonify({"error": f"OS Error listing directory {target_path}: {e.strerror}", "path": str(target_path), "logs": request_specific_logs}), 500

    with dir_iterator:
        for entry in dir_iterator:
            items_in_dir += 1
            entry_path_str = entry.path # Default to original path
            try:
                # Try to resolve, but handle potential errors (e.g., broken symlinks pointed to by entry)
                entry_path_str = str(Path(entry.path).resolve(strict=False))
            except Exception as resolve_err:
                resolve_msg = f"WARN: Could not resolve path for entry '{entry.name}': {resolve_err}"
                log.warning(resolve_msg)
                request_specific_logs.append(resolve_msg)
                # Keep entry_path_str as the original unresolved path

            item_info = { "name": entry.name, "path": entry_path_str, "size": None, "human_readable_size": "[Error]", "type": "unknown", "error": None }

            try:
                stat_result = entry.stat(follow_symlinks=False) # Get stats once if possible
                item_type = "unknown"

                if entry.is_file(follow_symlinks=False):
                    item_type = "file"
                    item_info["size"] = stat_result.st_size
                elif entry.is_dir(follow_symlinks=False):
                    item_type = "directory"
                    item_info["size"] = get_size(entry.path, request_logs=request_specific_logs)
                elif entry.is_symlink():
                     item_type = "symlink"
                     item_info["size"] = 0
                else: item_type = "other"; item_info["size"] = 0

                item_info["type"] = item_type
                if item_info["size"] is not None:
                    item_info["human_readable_size"] = human_readable_size(item_info["size"])
                    total_scan_size += item_info["size"]
                else: item_info["human_readable_size"] = "[Size Error]"

            except PermissionError as e:
                scan_errors += 1; msg = f"WARN: Permission denied accessing item props: {entry.path} ({e})"; log.warning(msg); request_specific_logs.append(msg)
                item_info["error"] = "Permission Denied"; item_info["human_readable_size"] = "[Permission Denied]"
                try: # Try to get type even if stats fail
                    if entry.is_dir(follow_symlinks=False): item_info["type"] = "directory"
                    elif entry.is_file(follow_symlinks=False): item_info["type"] = "file"
                    elif entry.is_symlink(): item_info["type"] = "symlink"
                except Exception: pass
            except FileNotFoundError as e:
                scan_errors += 1; msg = f"WARN: Item vanished during scan: {entry.path} ({e})"; log.warning(msg); request_specific_logs.append(msg)
                item_info["error"] = "Not Found"; item_info["human_readable_size"] = "[Not Found]"; item_info["size"] = None
            except OSError as e:
                scan_errors += 1; msg = f"WARN: OS Error accessing props of {entry.path}: {e}"; log.warning(msg); request_specific_logs.append(msg)
                item_info["error"] = f"OS Error: {e.strerror}"; item_info["human_readable_size"] = "[Access Error]"; item_info["size"] = None

            results.append(item_info)

    # Sort results: Put items with errors (None size) at the end
    results.sort(key=lambda x: x["size"] if x["size"] is not None else -1, reverse=True)

    final_msg = f"Analysis complete. Items: {items_in_dir}. Total Size: {human_readable_size(total_scan_size)}. Item Errors: {scan_errors}."
    log.info(f"Analysis complete for {target_path}: {final_msg}")
    request_specific_logs.append(f"INFO: {final_msg}")

    return jsonify({
        "path": str(target_path), # Return the canonical, resolved path
        "total_items_in_dir": items_in_dir,
        "total_scan_size": total_scan_size,
        "human_readable_total_scan_size": human_readable_size(total_scan_size),
        "scan_errors": scan_errors,
        "results": results,
        "logs": request_specific_logs
    })


if __name__ == '__main__':
    # For development only. Use Gunicorn/Waitress for production.
    # '127.0.0.1' is safer than '0.0.0.0' unless access from other devices is needed.
    app.run(debug=True, host='127.0.0.1', port=5000)