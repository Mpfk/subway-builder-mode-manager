# Mode Manager (Subway Builder Mod)

An all-in-one Subway Builder mod that lets players choose which transit modes are active per save — without installing or uninstalling separate mods.

## Features

- **Per-save mode selection** — add or remove modes independently for each game save
- **Safe removal** — modes with placed tracks or routes are locked and cannot be removed, preventing broken saves
- **Custom mode import** — paste any valid mode JSON definition into the Library to add community or custom modes
- **Instant reload** — adding or removing a mode reloads the mod automatically, no game restart required

## Built-in Modes

| Mode | Description |
|---|---|
| Tram | Lightweight tram for short-distance urban transit |
| Bus Rapid Transit | High-capacity bus for dedicated rapid transit corridors |
| Monorail | Elevated monorail for scenic urban and resort transit |
| People Mover | Automated people mover for short-distance elevated transit |

## Using the Panel

Open the **Mode Manager** toolbar button in-game to access the panel.

### This Save tab

Shows modes committed to the current save and modes available to add.

- **+ Add** — commits a mode to this save and reloads immediately
- **✕** — removes a mode that has not been placed yet
- **🔒** — the mode has placed tracks or routes and cannot be removed (hover for details)

### Library tab

Shows all available modes — built-in and imported.

- **Built-in** modes are always present and cannot be removed
- **Imported** modes show a 🗑️ button and can be removed if not committed to any save
- Paste a JSON mode definition into the **Import a Mode** field and click **Add Mode** to add a custom mode

## Custom Mode Import

A mode definition must be a JSON object with the following fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | Yes | Lowercase letters, numbers, and hyphens only |
| `name` | string | Yes | |
| `description` | string | Yes | |
| `stats` | object | Yes | See stats reference below |
| `compatibleTrackTypes` | string[] | Yes | e.g. `["tram"]` |
| `appearance` | object | Yes | Must include `color` (hex string) |
| `allowAtGradeRoadCrossing` | boolean | No | |
| `tags` | string[] | No | e.g. `["bus"]`, `["rail"]` |

**Required stats fields:** `maxAcceleration`, `maxDeceleration`, `maxSpeed`, `maxSpeedLocalStation`, `capacityPerCar`, `carLength`, `minCars`, `maxCars`, `carsPerCarSet`, `carCost`, `trainWidth`, `minStationLength`, `maxStationLength`, `baseTrackCost`, `baseStationCost`, `trainOperationalCostPerHour`, `carOperationalCostPerHour`, `scissorsCrossoverCost`

See [docs/modes/light-rail.json](docs/modes/light-rail.json) for a working example.

## Installation

Mod files are located in `mode-manager/` in this repository.

| Platform | Mods Folder |
|---|---|
| Windows | `%APPDATA%/metro-maker4/mods/` |
| macOS | `~/Library/Application Support/metro-maker4/mods/` |
| Linux | `~/.config/metro-maker4/mods/` |

1. Copy the `mode-manager/` folder into your mods folder
2. Launch Subway Builder
3. Open **Settings > Mods**, find **Mode Manager**, and toggle it on
4. Restart the game

For detailed platform instructions see [docs/mod-installation.md](docs/mod-installation.md).

---

## Contributing

Please [open an issue](../../issues) before submitting changes.

## License

See [LICENSE](LICENSE) for details.
