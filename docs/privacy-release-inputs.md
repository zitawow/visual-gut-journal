# Privacy and release inputs still required

The in-app privacy screen now matches the implemented Beta behavior: successful original photos remain in owner-only Supabase Private Storage; automatic deletion after analysis or seven days is not active; abandoned incomplete uploads may be cleaned up; full account deletion is backend-owned.

The following items cannot be safely invented in code and block a real-photo external beta.

## Product owner information

- Operating legal entity or individual name shown to users.
- Privacy/support contact email that will be monitored.
- Main operating jurisdiction and intended launch countries.
- Minimum user age and whether minors are excluded.
- Final public Privacy Policy domain/URL.
- Desired response period for privacy/access/deletion requests.

## Roboflow confirmation

Obtain written terms or a contract that specifically covers Hosted/Serverless inference images used by this app:

- Whether inference request images are retained and for how long.
- Whether request images or derived data may be used for training, research, optimization, or service improvement.
- Processing/storage regions and subprocessors.
- Deletion mechanism and security commitments.
- Whether the selected plan permits an external/commercial closed beta involving end-user images.
- Whether an appropriate DPA is available for the intended jurisdictions and sensitive wellness data.

Do not infer these answers from dataset-upload documentation; dataset storage and one-off inference requests are different data flows. Roboflow's current general Terms state that the Public Plan is for internal, non-commercial use and contain broad User Content provisions. This requires confirmation before real external users upload sensitive photos.

Official references reviewed 2026-09-02:

- https://roboflow.com/terms
- https://roboflow.com/privacy
- https://docs.roboflow.com/adding-data

## Apple / TestFlight inputs

- Paid Apple Developer membership and team access.
- Expo/EAS account used for the project.
- Confirmation that `com.visualgutjournal.app` is the desired Bundle ID.
- App Store Connect app name and SKU.
- Dedicated User A/User B beta test accounts and passwords stored outside Git.
- Physical iPhone and iOS version for camera, biometrics, backgrounding, and weak-network tests.

## Supabase Auth setup

Add only the real development and production recovery destinations to the Auth redirect allow-list, including the native scheme `visualgutjournal://reset-password` and the final HTTPS `/reset-password` URL. Do not use wildcard production redirects.
