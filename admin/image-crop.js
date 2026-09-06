const IMAGE_CROP_MAX_WIDTH = 1200;
const IMAGE_CROP_ASPECT = 16 / 9;
const IMAGE_CROP_QUALITY = 0.85;

const ImageCropper = (() => {
  let modal = null;
  let imageEl = null;
  let cropper = null;
  let resolvePromise = null;
  let rejectPromise = null;
  let objectUrl = null;

  function revokeObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function ensureModal() {
    if (modal) {
      return;
    }

    modal = document.createElement('div');
    modal.className = 'crop-modal hidden';
    modal.innerHTML = `
      <div class="crop-modal-backdrop" data-crop-action="cancel"></div>
      <div class="crop-modal-panel" role="dialog" aria-modal="true" aria-labelledby="crop-modal-title">
        <div class="crop-modal-header">
          <div>
            <h3 id="crop-modal-title" class="crop-modal-title">Beskær billede</h3>
            <p class="crop-modal-sub">Bredformat 16:9 — træk og zoom for at tilpasse</p>
          </div>
          <button type="button" class="crop-modal-close" data-crop-action="cancel" aria-label="Luk">×</button>
        </div>
        <div class="crop-modal-body">
          <img id="crop-modal-image" alt="Billede til beskæring">
        </div>
        <div class="crop-modal-actions">
          <button type="button" class="media-btn" data-crop-action="cancel">Annuller</button>
          <button type="button" class="media-btn primary" data-crop-action="confirm">Upload billede</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    imageEl = modal.querySelector('#crop-modal-image');

    modal.addEventListener('click', (event) => {
      const action = event.target.closest('[data-crop-action]')?.dataset.cropAction;
      if (!action) {
        return;
      }
      if (action === 'cancel') {
        close(null);
      }
      if (action === 'confirm') {
        confirmCrop();
      }
    });
  }

  function destroyCropper() {
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    if (imageEl) {
      imageEl.removeAttribute('src');
    }
    revokeObjectUrl();
  }

  function close(result) {
    destroyCropper();
    modal?.classList.add('hidden');

    if (result instanceof Blob) {
      resolvePromise?.(result);
    } else {
      rejectPromise?.(new Error('Crop annulleret.'));
    }

    resolvePromise = null;
    rejectPromise = null;
  }

  function confirmCrop() {
    if (!cropper) {
      return;
    }

    const canvas = cropper.getCroppedCanvas({
      maxWidth: IMAGE_CROP_MAX_WIDTH,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    });

    if (!canvas) {
      close(null);
      return;
    }

    canvas.toBlob((blob) => {
      if (!blob) {
        close(null);
        return;
      }
      close(blob);
    }, 'image/jpeg', IMAGE_CROP_QUALITY);
  }

  function open(file) {
    ensureModal();

    if (typeof Cropper === 'undefined') {
      return Promise.reject(new Error('Cropper.js kunne ikke indlæses.'));
    }

    if (!(file instanceof Blob)) {
      return Promise.reject(new Error('Ugyldig fil.'));
    }

    destroyCropper();

    return new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;

      revokeObjectUrl();
      objectUrl = URL.createObjectURL(file);
      imageEl.onload = () => {
        cropper = new Cropper(imageEl, {
          aspectRatio: IMAGE_CROP_ASPECT,
          viewMode: 1,
          dragMode: 'move',
          autoCropArea: 1,
          responsive: true,
          background: false,
          checkCrossOrigin: false,
        });
        modal.classList.remove('hidden');
      };
      imageEl.onerror = () => {
        revokeObjectUrl();
        reject(new Error('Kunne ikke indlæse billedet.'));
      };
      imageEl.src = objectUrl;
    });
  }

  return { open };
})();

window.ImageCropper = ImageCropper;
