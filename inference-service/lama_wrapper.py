"""
Inpainting wrapper — multi-method fallback strategy.

Priority:
  1. LaMa (if checkpoint available and architecture loadable)
  2. OpenCV NS (Navier-Stokes based, good for textures)
  3. OpenCV Telea (fast fallback)

In practice, OpenCV NS produces decent results for architectural scenes
(walls, straight lines, repeating textures) which is the primary use
case for this paint visualizer.
"""

import os
import numpy as np
import cv2


class InpaintingModel:
    """Multi-method inpainting with automatic fallback."""

    def __init__(self, device=None):
        self.device = device
        self.model = None
        self.method = "opencv_ns"
        self._try_load_lama()

    def _try_load_lama(self):
        """Attempt to load LaMa. Succeeds only if the full LaMa environment is set up."""
        try:
            import torch
            checkpoint_path = os.environ.get(
                "LAMA_CHECKPOINT",
                os.path.join(os.path.dirname(__file__), "big-lama.pt"),
            )
            if not os.path.exists(checkpoint_path):
                print("[inpaint] LaMa checkpoint not found — using OpenCV NS inpainting")
                return

            # Try loading the full LaMa model (requires the lama package)
            from lama.lama_modules import LaMaFourier
            self.model = torch.jit.load(checkpoint_path, map_location=self.device)
            self.model.eval()
            self.method = "lama"
            print("[inpaint] LaMa model loaded successfully")
        except ImportError:
            print("[inpaint] LaMa architecture not available — using OpenCV NS inpainting")
        except Exception as e:
            print(f"[inpaint] LaMa load failed ({e}) — using OpenCV NS inpainting")

    def _inpaint_lama(self, image_bgr, mask_bin):
        """Run LaMa inpainting."""
        import torch

        h, w = image_bgr.shape[:2]
        pad_h = (8 - h % 8) % 8
        pad_w = (8 - w % 8) % 8
        if pad_h or pad_w:
            image_bgr = cv2.copyMakeBorder(image_bgr, 0, pad_h, 0, pad_w, cv2.BORDER_REFLECT)
            mask_bin = cv2.copyMakeBorder(mask_bin, 0, pad_h, 0, pad_w, cv2.BORDER_CONSTANT, value=0)

        image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        image_tensor = torch.from_numpy(image_rgb).permute(2, 0, 1).unsqueeze(0).to(self.device)
        mask_tensor = torch.from_numpy(mask_bin.astype(np.float32) / 255.0).unsqueeze(0).unsqueeze(0).to(self.device)

        output = self.model(image_tensor, mask_tensor)
        result = output.squeeze(0).permute(1, 2, 0).cpu().numpy()
        result = np.clip(result * 255, 0, 255).astype(np.uint8)
        result = cv2.cvtColor(result, cv2.COLOR_RGB2BGR)

        if pad_h or pad_w:
            result = result[:h, :w]
        return result

    def _inpaint_opencv(self, image_bgr, mask_bin):
        """Run OpenCV Navier-Stokes inpainting (good for structural scenes)."""
        return cv2.inpaint(image_bgr, mask_bin, inpaintRadius=7, flags=cv2.INPAINT_NS)

    def __call__(self, image_bgr: np.ndarray, mask_bin: np.ndarray) -> np.ndarray:
        """
        Inpaint an image using the provided mask.

        Args:
            image_bgr: BGR image (H, W, 3) uint8.
            mask_bin: Binary mask (H, W) uint8, 255 = area to inpaint.

        Returns:
            Inpainted BGR image (H, W, 3) uint8.
        """
        h, w = image_bgr.shape[:2]

        if self.model is not None and self.method == "lama":
            result = self._inpaint_lama(image_bgr, mask_bin)
        else:
            result = self._inpaint_opencv(image_bgr, mask_bin)

        # Blend: use inpainted result only where mask is active
        mask_3ch = cv2.cvtColor(mask_bin, cv2.COLOR_GRAY2BGR) / 255.0
        blended = (result * mask_3ch + image_bgr * (1 - mask_3ch)).astype(np.uint8)

        return blended
