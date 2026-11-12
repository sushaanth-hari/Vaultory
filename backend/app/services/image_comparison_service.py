import os
import cv2
import numpy as np
import logging
from typing import Dict, Any, Tuple
from app.services.cloudinary_service import storage_service

logger = logging.getLogger(__name__)

class ImageComparisonService:
    def compare_condition_photos(
        self,
        original_img_path: str,
        current_img_path: str,
        original_photo_id: int,
        current_photo_id: int
    ) -> Dict[str, Any]:
        """
        Uses OpenCV to perform computer vision visual comparison between original and current product condition photos.
        Calculates:
        - Structural similarity / difference score
        - ORB feature keypoint matching
        - Pixel variance heatmap
        - Generates a side-by-side composite visual diff image
        """
        if not os.path.exists(original_img_path):
            raise FileNotFoundError(f"Original image not found: {original_img_path}")
        if not os.path.exists(current_img_path):
            raise FileNotFoundError(f"Current image not found: {current_img_path}")

        # 1. Read images with OpenCV
        img1 = cv2.imread(original_img_path)
        img2 = cv2.imread(current_img_path)

        if img1 is None or img2 is None:
            raise ValueError("Failed to decode one or both images with OpenCV.")

        # 2. Resize both images to standard comparison dimensions (500x500)
        target_size = (500, 500)
        img1_resized = cv2.resize(img1, target_size, interpolation=cv2.INTER_AREA)
        img2_resized = cv2.resize(img2, target_size, interpolation=cv2.INTER_AREA)

        # 3. Convert to grayscale for structural analysis
        gray1 = cv2.cvtColor(img1_resized, cv2.COLOR_BGR2GRAY)
        gray2 = cv2.cvtColor(img2_resized, cv2.COLOR_BGR2GRAY)

        # Apply slight Gaussian blur to eliminate minor camera sensor noise
        blur1 = cv2.GaussianBlur(gray1, (5, 5), 0)
        blur2 = cv2.GaussianBlur(gray2, (5, 5), 0)

        # 4. Compute Absolute Difference & Heatmap
        diff = cv2.absdiff(blur1, blur2)
        _, thresh = cv2.threshold(diff, 35, 255, cv2.THRESH_BINARY)
        
        # Colorize difference heatmap using JET colormap
        heatmap = cv2.applyColorMap(diff, cv2.COLORMAP_JET)

        # Highlight contours on the current image
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        annotated_current = img2_resized.copy()
        cv2.drawContours(annotated_current, contours, -1, (0, 0, 255), 2)

        # 5. ORB Feature Matching
        orb = cv2.ORB_create(nfeatures=500)
        kp1, des1 = orb.detectAndCompute(gray1, None)
        kp2, des2 = orb.detectAndCompute(gray2, None)

        matched_keypoints_count = 0
        if des1 is not None and des2 is not None and len(des1) > 0 and len(des2) > 0:
            bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
            matches = bf.match(des1, des2)
            matches = sorted(matches, key=lambda x: x.distance)
            matched_keypoints_count = len([m for m in matches if m.distance < 50])

        # 6. Quantitative Similarity Score
        # Mean Squared Error (MSE)
        mse = np.mean((blur1.astype("float") - blur2.astype("float")) ** 2)
        
        # Normalized similarity percentage (0% to 100%)
        # For 8-bit images, max MSE is 255^2 = 65025. Typically MSE < 1500 is very similar.
        diff_ratio = min(1.0, mse / 3000.0)
        similarity_score = max(5.0, round((1.0 - diff_ratio) * 100.0, 1))
        diff_percentage = round(100.0 - similarity_score, 1)

        # 7. Wear Analysis & Condition Verdict
        wear_analysis = []
        if similarity_score >= 90.0:
            verdict = "Pristine / Mint Condition"
            wear_analysis.append("Negligible physical alteration detected.")
            wear_analysis.append("Surface finishes, logos, and structural lines match original capture.")
        elif similarity_score >= 75.0:
            verdict = "Minor Cosmetic Wear"
            wear_analysis.append("Slight surface or lighting variations detected.")
            wear_analysis.append("Standard light usage wear; no critical structural defects.")
        elif similarity_score >= 55.0:
            verdict = "Moderate Wear / Surface Scratches"
            wear_analysis.append("Noticeable surface deviations or scuffs detected.")
            wear_analysis.append("Key visual markers indicate usage patterns over time.")
        else:
            verdict = "Significant Degradation / Visible Damage"
            wear_analysis.append("Major structural or cosmetic differences observed.")
            wear_analysis.append("Substantial discoloration, cracks, or distinct physical alterations.")

        wear_analysis.append(f"Computer Vision ORB feature match count: {matched_keypoints_count}")
        wear_analysis.append(f"Image MSE (Mean Squared Error): {round(mse, 2)}")

        # 8. Create a 3-Panel Composite Image:
        # [ Original ] | [ Current (with difference contours) ] | [ Difference Heatmap ]
        # Add labels to each panel
        def add_label(img, text, color=(255, 255, 255), bg_color=(0, 0, 0)):
            h, w = img.shape[:2]
            overlay = img.copy()
            cv2.rectangle(overlay, (0, h - 35), (w, h), bg_color, -1)
            cv2.addWeighted(overlay, 0.7, img, 0.3, 0, img)
            cv2.putText(img, text, (15, h - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2, cv2.LINE_AA)
            return img

        p1 = add_label(img1_resized.copy(), "ORIGINAL RECORD", (0, 255, 0))
        p2 = add_label(annotated_current, "CURRENT STATUS (Contoured)", (0, 165, 255))
        p3 = add_label(heatmap, f"CV DIFF HEATMAP ({diff_percentage}% Δ)", (255, 255, 255), (50, 0, 0))

        composite = np.hstack((p1, p2, p3))

        # Encode composite image to JPEG bytes
        success, encoded_img = cv2.imencode(".jpg", composite, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
        if not success:
            raise RuntimeError("Failed to encode composite comparison image.")

        diff_url, _ = storage_service.save_bytes(
            encoded_img.tobytes(),
            f"diff_{original_photo_id}_{current_photo_id}.jpg"
        )

        return {
            "original_photo_id": original_photo_id,
            "current_photo_id": current_photo_id,
            "similarity_score": similarity_score,
            "structural_difference_percentage": diff_percentage,
            "verdict": verdict,
            "diff_heatmap_url": diff_url,
            "keypoints_matched": matched_keypoints_count,
            "wear_analysis": wear_analysis,
            "details": {
                "mse": round(mse, 2),
                "contours_found": len(contours),
                "resolution_evaluated": "500x500 px",
                "color_space": "BGR -> Grayscale -> Gaussian(5x5) -> Jet Colormap"
            }
        }

image_comparison_service = ImageComparisonService()

