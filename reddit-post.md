**Title**
> Browser tool to generate MeshCore keys with a custom prefix (cafe, deadbeef, …)

**Body**

I wanted MeshCore node IDs that start with something recognizable, but the standard Ed25519 tools export PKCS#8/JWK and MeshCore wants the 64-byte / 128-hex raw format. So I vibecoded this over a weekend:

[valentinvieriu.github.io/MeshCore-Private-Key-Generator](https://valentinvieriu.github.io/MeshCore-Private-Key-Generator/)

- Pick a prefix (1-8 hex chars), it searches until the public key matches
- Outputs the 128-hex MeshCore key, validated end to end
- Has a preset list if you want ideas: cafe, c0ffee, deadbeef, f00d, bada55, 5eed…
- Runs fully in the browser, no server, no upload. Works offline once loaded.

Source: [github.com/valentinvieriu/MeshCore-Private-Key-Generator](https://github.com/valentinvieriu/MeshCore-Private-Key-Generator)

Rough timing on a laptop: 2 hex chars is instant, 4 takes seconds, 6 is seconds to minutes, 8 is a coffee break.

Usual warning — these are real keys, keep them secret, and since it's vibecoded and you probably shouldn't trust random web pages with key material anyway, read the source first or load the page offline.

Feedback welcome.
