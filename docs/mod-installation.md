# Mode Manager — Complete Installation Guide

This guide provides step-by-step instructions to install and enable the Mode Manager mod for Subway Builder on Windows, macOS, and Linux.

## Prerequisites

- **Subway Builder desktop version** installed and working
- A file manager or terminal with access to your home directory
- Basic familiarity with navigating folders on your system

## Finding Your Mods Folder

### In-Game Method (Easiest)

The easiest way to locate your mods folder is directly from the game:

1. **Open Subway Builder**
2. Navigate to **Settings > System**
3. Select **Open Saves Folder**
4. A file manager window opens showing your game data directory
5. Look for (or create) a folder named `mods`

### Manual Navigation by Platform

If the in-game method doesn't work, use these platform-specific paths:

#### Windows

Your mods folder is located at:

```
%APPDATA%/metro-maker4/mods/
```

**How to access it:**
1. Press `Windows Key + R` to open Run
2. Type: `%APPDATA%\metro-maker4\mods`
3. Press Enter
4. If the folder doesn't exist, you'll need to create the directory structure manually (see **Setting Up Your Mods Folder** below)

#### macOS

Your mods folder is located at:

```
~/Library/Application Support/metro-maker4/mods/
```

**How to access it:**
1. Open Finder
2. Press `Cmd + Shift + G` (Go to Folder)
3. Copy and paste: `~/Library/Application Support/metro-maker4/mods/`
4. Press Enter
5. If the folder doesn't exist, create it (see **Setting Up Your Mods Folder** below)

#### Linux

Your mods folder is located at:

```
~/.config/metro-maker4/mods/
```

**How to access it:**
1. Open your file manager
2. Navigate to your home folder
3. Show hidden files (usually `Ctrl + H`)
4. Open `.config/metro-maker4/mods/`
5. If the folder doesn't exist, create it (see **Setting Up Your Mods Folder** below)

## Setting Up Your Mods Folder

If your mods folder doesn't exist, you need to create the directory structure:

### Windows

1. Press `Windows Key + E` to open File Explorer
2. Navigate to `%APPDATA%` (use the address bar)
3. Create a new folder named `metro-maker4`
4. Inside `metro-maker4`, create a new folder named `mods`

### macOS

1. Open Finder
2. Press `Cmd + Shift + G`
3. Navigate to: `~/Library/Application Support`
4. Create a new folder named `metro-maker4`
5. Inside `metro-maker4`, create a new folder named `mods`

### Linux

1. Open a terminal
2. Run these commands:
   ```bash
   mkdir -p ~/.config/metro-maker4/mods
   ```

## File Structure

The Mode Manager mod consists of these files:

```
mods/
├── mode-manager/
│   ├── manifest.json    (mod metadata)
│   └── index.js         (mod implementation)
```

- `manifest.json`: Defines the mod's name, version, and entry point
- `index.js`: Contains the mod's code that registers transit modes and renders the mode picker UI

## Installation Steps

### Step 1: Download or Locate the Mod Files

The Mode Manager mod files are located in the `mode-manager/` directory of this repository.

### Step 2: Copy the Mod Folder

1. Navigate to your mods folder (see **Finding Your Mods Folder** above)
2. Copy the `mode-manager` folder from the repository into your mods directory
3. Your mods folder should now contain: `mods/mode-manager/`

### Step 3: Verify the Installation

Check that you have:

```
<mods-folder>/mode-manager/manifest.json
<mods-folder>/mode-manager/index.js
```

If both files are present, the mod is correctly installed.

## Enabling the Mod In-Game

### Enable Mode Manager

1. **Launch Subway Builder**
2. Navigate to **Settings > Mods**
3. In the mods list, find **"Mode Manager"**
4. Toggle the switch to **enable** the mod
5. You'll see a confirmation message

### Restart to Apply

1. **Exit Subway Builder completely**
2. **Reopen Subway Builder**

Mode Manager is now active. Use the in-game mode picker panel to choose which transit modes are available in your network.

### Using Mode Manager in the Game

Once enabled:
- Open the Mode Manager panel from the in-game UI
- Toggle individual transit modes (Tram, BRT, Monorail, People Mover) on or off
- Enabled modes appear as train type options when building or editing lines

## Hot Reload (Optional)

Some versions of Subway Builder support hot reload, allowing you to edit mod code and see changes immediately:

1. **Enable hot reload in Settings > Developer** (if available)
2. **Edit `index.js`** in your `mode-manager` folder
3. **Save the file**
4. Changes may appear immediately (game-dependent)

If hot reload is unavailable, you'll need to fully restart the game after editing mod code.

## Disabling the Mod

To temporarily disable Mode Manager without uninstalling:

1. Open Subway Builder
2. Navigate to **Settings > Mods**
3. Find **"Mode Manager"** in the list
4. Toggle the switch to **disable**
5. Restart the game

The mod files remain installed and can be re-enabled at any time.

## Uninstalling the Mod

To completely remove Mode Manager:

1. Navigate to your mods folder
2. Delete the `mode-manager` folder entirely
3. Restart Subway Builder

The mod will no longer appear in the mods list.

## Troubleshooting

### Mod Not Appearing in Settings > Mods

**Problem:** "Mode Manager" doesn't show up in the mods list.

**Solutions:**
- Verify the folder is exactly named `mode-manager` (lowercase, with hyphen)
- Confirm both `manifest.json` and `index.js` are in the `mode-manager` folder
- Check that `manifest.json` is valid JSON (no syntax errors)
- Verify the mod is in the correct platform folder (see **Finding Your Mods Folder**)
- Restart Subway Builder completely
- Check that you're on the latest version of Subway Builder

### Mod Appears but Toggle Won't Enable

**Problem:** You can see "Mode Manager" in Settings > Mods, but toggling it has no effect.

**Solutions:**
- Verify both `manifest.json` and `index.js` contain valid syntax
- Check the game's error log for JavaScript errors
- Ensure `index.js` doesn't have runtime errors on load
- Try restarting the game
- Verify your system's JavaScript runtime is functioning correctly

### Game Crashes After Enabling Mod

**Problem:** Subway Builder crashes or behaves unexpectedly after enabling Mode Manager.

**Solutions:**
- Disable the mod (see **Disabling the Mod**)
- Verify the `index.js` file is not corrupted
- Check that you downloaded the mod from the official repository
- Re-download and reinstall the mod
- Report the issue with crash logs to the project repository

### Can't Find the Mods Folder

**Problem:** The folder paths don't work or you can't locate your mods directory.

**Solutions:**
- Use the in-game method: Settings > System > Open Saves Folder
- Create the folder structure manually (see **Setting Up Your Mods Folder**)
- On Windows, ensure `%APPDATA%` correctly resolves to your user directory
- On macOS/Linux, confirm hidden files are visible in your file manager
- Check that you have read/write permissions for the directory

### Mode Works Inconsistently

**Problem:** The mod works sometimes but behaves unpredictably.

**Solutions:**
- Restart Subway Builder completely (not just the game window)
- Disable and re-enable the mod in Settings > Mods
- Verify your `mode-manager` folder and files haven't been accidentally modified
- Check for updates to Subway Builder (compatibility issues may be resolved)

### Still Having Issues?

If you've tried the above solutions:
1. Verify your installation matches the **File Structure** section
2. Check that platform-specific paths are correct for your operating system
3. Open an issue in the repository with:
   - Your operating system and version
   - Steps to reproduce the problem
   - Any error messages from the game
   - Screenshots if applicable

## More Information

- **Repository:** The Mode Manager mod source code and development info is available in the `mode-manager/` directory
- **Configuration:** See `workflow.conf` for project settings
- **Contributing:** See the main README for development workflow information
