---
title: FAQ
---

- **Where can I change settings, league?**

  Open Path of Exile 2 and press overlay key `Ctrl + Alt + P`. Click on the button with cog icon there.
  ![overlay](/reference-images/overlay-keybind.png)

- **Where can I find the logs?**

  In the settings under the "Debug" tab.
  ![logs](/reference-images/logs.png)

- **Is this app approved by GGG? Can I get banned for using it?**

  There are no approved apps created by community. If app complies with the [game ToS](https://www.pathofexile.com/legal/terms-of-use-and-privacy-policy), does one server action per button press
  and doesn't interact with the game client itself (injecting into the process, changing the process memory aka cheats)
  it can be considered safe.

  If you get banned, the first action is to [Contact Support](https://www.pathofexile.com/support)

- **I want to `Ctrl + Scroll` stash tabs without zooming my character.**

  You can disable "Mousewheel Zoom" in PoE settings (Options -> UI -> 3-rd check mark starting from the bottom)
  ![mousewheel zoom](/reference-images/mousewheel-zoom.png)

  Don't worry, you still can use keys
  ![zoom keybinds](/reference-images/zoom-keybinds.png)

- **Do Private Leagues work?**

  Yes, but you will need to sign in via the builtin browser. See [here](/private-leagues) for more info

- **Will my language be supported?**

  Maybe, would need the app_i18n file to be translated to your language

- **I downloaded a zip with a bunch of files, but no executable inside?**

  You have downloaded the source code. Build the native Linux host with `./testUpdate.sh`.

- **I can't price check items in Divination Card stash tab.**\
  **I can't price check rewards in Curio Display room (Heist Blueprints).**\
  **I can't check modifiers of the maps proposed by Kirac.**

  Yes, you can't. The game doesn't copy anything to clipboard when pressing `Ctrl + C` in these places.
  And as mentioned in the [Quick Start](/quick-start), the whole thing how
  app works based on text of item in clipboard.

  Regarding Divination Card stash tab, you can use another 3rd-party apps that
  price check your stash tabs (e.g. [poestack](https://poestack.com/))

- **What does the orange/red circle (next to the item's listed time) mean?**

  It shows player's status: AFK/Offline respectively.

- **What does question mark (next to the item's price) mean?**

  It's shown when item is priced using stash tab name instead of being individually priced.

  The intention here is to make you aware that price is likely not real and is only so high because the item has been thrown in dump tab.

- **How do I disable auto-updates?**

  This is possible by using the [command line flag](/cmd-flags).

- **Why does a sound play when I price check an item?**

  Discord :( Change the default key for saving clips. By default it is `Alt + c` which is pressed by EE2 every time a price check happens.

- **Is exiledexchange2.com an official website?**

  This Linux fork is maintained separately from upstream Exiled Exchange 2. Prefer releases from the repository you built or installed from, and treat unknown mirrors as unsafe.

- [Index Page](/index-page.md)
