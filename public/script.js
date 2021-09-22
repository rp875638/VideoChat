let localstream = null;
document.getElementById('beforeJoinModal').addEventListener('show.bs.modal', async function(event) {
    const constraints = {
        'audio': {
            'echoCancellation': true
        },
        'video': {
            'width': {
                'min': 840
            },
            'height': {
                'min': 440
            }
        }
    }
    try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        document.getElementById('previewVideo').srcObject = localStream;
    } catch (error) {

        console.log(error.message);
    }
});
document.getElementById('joinModal').addEventListener('show.bs.modal', async function(event) {
    try {
        joinChat();
        document.getElementById('previewVideo').srcObject = null;
        document.getElementById('localVideo').srcObject = localStream;
    } catch (error) {
        console.log(error.nessage);
    }

});
document.getElementById('joinModal').addEventListener('hide.bs.modal', async function(event) {
    try {
        hangUp();
    } catch (error) {
        console.log(error.message);
    }

});

var beforeJoinModal = new bootstrap.Modal(document.getElementById('beforeJoinModal'), {
    backdrop: 'static',
    keyboard: false,
    focus: true
});
beforeJoinModal.show();