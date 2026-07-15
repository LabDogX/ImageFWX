# Bundled font notices

ImageFWX installs the following distribution packages in its Docker image so
ImageMagick can render server-side watermarks consistently.

| Family | Docker package | License | Purpose |
| --- | --- | --- | --- |
| Noto / Source Han CJK | `fonts-noto-cjk` | SIL Open Font License 1.1 | Chinese, Japanese, Korean, and Latin fallback |
| DejaVu | `fonts-dejavu-core` | Bitstream Vera / DejaVu licenses | Sans, serif, and monospaced defaults |
| Inter | `fonts-inter` | SIL Open Font License 1.1 | Modern Latin UI and title watermark option |
| Open Sans | `fonts-open-sans` | Apache License 2.0 | Readable Latin watermark option |

These fonts may be bundled with ImageFWX and used to render output images under
their respective licenses. They are not sold or redistributed as standalone
font products. The project keeps this notice and the upstream package copyright
information distributed by Debian. No unverified local font archive is bundled.
