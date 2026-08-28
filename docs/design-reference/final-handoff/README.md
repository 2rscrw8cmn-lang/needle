# Final Needle visual reference bundle

This directory carries the **exact designer handoff bundle** supplied for the final Needle redesign.

## Use this before visual implementation

1. Run:
   ```bash
   python docs/design-reference/final-handoff/restore_design_reference.py
   ```
2. Open the extracted designer files locally in a browser:
   - `source/design_handoff_needle_redesign/Needle Handoff Spec.dc.html` — read first.
   - `source/design_handoff_needle_redesign/Needle Redesign.dc.html` — visual mockups and interaction studies.
3. Canonical IDs inside `Needle Redesign.dc.html`:
   - Home `3a`
   - Album `2a`
   - Library `1e`
   - History `4a`
   - Mobile Home `5a`
   - Mobile Library `5b`
   - Explore `5c`
   - States `5d`
   - Scroll study `6a`

The HTML is **design reference, not production code**. Recreate it using Needle's existing Next.js/React/CSS/data architecture. Do not port prototype markup or fake runtime data.

The extraction script reconstructs the original ZIP byte-for-byte from the checked-in base64 parts and verifies SHA-256:

`87ebcd073cec6631bca88824a9293820d0dacb58fc7f485cdd164b10966bdcad`

The checked-in `Needle Handoff Spec.dc.html` at this directory root is also provided for quick source inspection. The reconstructed bundle contains the complete original HTML plus `support.js`, `doc-page.js`, README, and screen map required to run the prototypes locally.
