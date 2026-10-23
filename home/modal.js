/* home/modal.js — নতুন রুম তৈরির মডাল + ছবি কাটা (Cropper) */

console.log('[MOI] modal.js loaded');

let cropper = null;
let currentRoomUid = '';

function initModal(){
    const imageInput = document.getElementById('modalImgInput');
    const cropperModal = document.getElementById('cropperModal');
    const cropperImage = document.getElementById('cropperImage');
    const uploadBox = document.getElementById('uploadBox');
    const croppedPreview = document.getElementById('croppedPreview');

    uploadBox.addEventListener('click', () => imageInput.click());

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            cropperImage.src = event.target.result;
            cropperModal.classList.add('show');
            if (cropper) cropper.destroy();
            cropper = new Cropper(cropperImage, { aspectRatio:1, viewMode:1, background:false, autoCropArea:0.8 });
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('cropSaveBtn').addEventListener('click', () => {
        if (!cropper) return;
        const canvas = cropper.getCroppedCanvas({ width:300, height:300 });
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        croppedPreview.src = dataUrl;
        croppedPreview.style.display = 'block';
        uploadBox.querySelector('.fa-plus').style.display = 'none';
        cropperModal.classList.remove('show');
        cropper.destroy();
        cropper = null;
    });

    document.getElementById('cropCancelBtn').addEventListener('click', () => {
        cropperModal.classList.remove('show');
        if (cropper){ cropper.destroy(); cropper = null; }
        imageInput.value = '';
    });

    /* ═══ নতুন রুম তৈরির মডাল খোলা (আমার রুম রেলের + বক্স থেকে ডাকা হয়) ═══ */
    async function openCreateRoom(){
        if (!window.userReady){ alert('ইউজার লোড হচ্ছে...'); return; }
        if (window.user.myRoomUid){
            location.href = window.LINKS.room + '?room=' + encodeURIComponent(window.user.myRoomUid);
            return;
        }
        if (window.user.isGuest){ alert('গেস্ট রুম বানাতে পারে না। Google বা ফোন দিয়ে লগইন করুন।'); return; }
        document.getElementById('modalRoomUid').value = 'অটো';
        document.getElementById('modalGroupName').value = '';
        document.getElementById('modalCountry').value = '';
        croppedPreview.src = '';
        croppedPreview.style.display = 'none';
        const plus = uploadBox.querySelector('.fa-plus');
        if (plus) plus.style.display = '';
        document.getElementById('roomModal').classList.add('show');
    }
    window.openCreateRoom = openCreateRoom;

    document.getElementById('modalCloseBtn').addEventListener('click', () => {
        document.getElementById('roomModal').classList.remove('show');
    });

    /* ═══ Submit — রুম সার্ভারে (createRoom ফাংশন) তৈরি হয় ═══ */
    document.getElementById('modalSubmitBtn').addEventListener('click', async () => {
        const groupName = document.getElementById('modalGroupName').value.trim();
        const country = document.getElementById('modalCountry').value;
        const croppedImgBase64 = croppedPreview.src || '';
        if (!groupName){ alert('অনুগ্রহ করে গ্রুপের নাম দিন।'); return; }
        if (!window.user.uid){ alert('ইউজার লোড হয়নি।'); return; }

        const btn = document.getElementById('modalSubmitBtn');
        const oldTxt = btn.innerHTML;
        btn.innerHTML = 'Saving...';
        btn.disabled = true;

        try {
            const r = await MOIEco.call('createRoom', { name: groupName, country: country || 'Unknown' });
            const id = r.id;
            if (croppedImgBase64 && croppedImgBase64.indexOf('data:') === 0){
                const url = await MOIStorage.roomLogo(id, croppedImgBase64);
                MOISync.watch('moi_demo_rooms');
                saveRoom(id, { logo: url });
            }
            document.getElementById('roomModal').classList.remove('show');
            setTimeout(() => { location.href = window.LINKS.room + '?room=' + encodeURIComponent(id); }, 300);
        } catch(err){
            alert('রুম বানানো যায়নি: ' + (err.userMsg || err.message));
            btn.innerHTML = oldTxt;
            btn.disabled = false;
        }
    });
}

window.initModal = initModal;
