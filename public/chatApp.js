// DEfault configuration - Change these if you have a different STUN or TURN server.

const configuration = {
    iceServers: [{
        urls: [
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302',
        ],
    }, ],
    iceCandidatePoolSize: 10,
};

let peerConnection = null;
let localStream = null;
let remoteStream = null;
let roomDialog = null;
let roomId = null;
const db = firebase.firestore();

async function createPeerConnection() {
    console.log('Create PeerConnection with configuration: ', configuration);
    peerConnection = new RTCPeerConnection(configuration);
    registerPeerConnectionListeners();
}

async function addLocalStream() {

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });
}

async function createOffer(roomRef) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    const roomWithOffer = {
        offer: {
            type: offer.type,
            sdp: offer.sdp
        }
    }
    return await db.collection('rooms').doc(`${roomRef.id}`).set(roomWithOffer);
}

async function createAnswer(roomSnapshot, roomRef) {
    const offer = roomSnapshot.data().offer;
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    const roomWithAnswer = {
        answer: {
            type: answer.type,
            sdp: answer.sdp
        }
    }
    await roomRef.update(roomWithAnswer);
}

async function remoteSessionDiscription(roomRef) {
    roomRef.onSnapshot(async snapshot => {
        console.log('Got updated room:', snapshot.data());
        const data = snapshot.data();
        if (!peerConnection.currentRemoteDescription && data.answer) {
            console.log('Set remote description: ', data.answer);
            const answer = new RTCSessionDescription(data.answer)
            await peerConnection.setRemoteDescription(answer);
        }
    });
}

async function addRemoteTrack() {
    remoteStream = new MediaStream();

    peerConnection.addEventListener('track', event => {
        console.log('Got remote track:', event.streams[0]);
        event.streams[0].getTracks().forEach(track => {
            console.log('Add a track to the remoteStream:', track);
            remoteStream.addTrack(track);
        });
    });
    document.querySelector('#remoteVideo').srcObject = remoteStream;
}

async function collectLocalICE(roomRef, name) {
    const candidatesCollection = roomRef.collection(name);

    peerConnection.addEventListener('icecandidate', event => {
        if (event.candidate) {
            const json = event.candidate.toJSON();
            candidatesCollection.add(json);
        }
    });
}

async function remoteICE(roomRef, name) {
    roomRef.collection(name).onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === "added") {
                const candidate = new RTCIceCandidate(change.doc.data());
                peerConnection.addIceCandidate(candidate);
            }
        });
    })
}


async function joinRoomById(id) {
    roomId = id;
    const roomRef = db.collection('rooms').doc(`${roomId}`);
    const roomSnapshot = await roomRef.get();
    console.log('Got room:', roomSnapshot.exists);

    if (roomSnapshot.exists) {
        createPeerConnection();
        await addLocalStream();
        collectLocalICE(roomRef, 'calleeCandidates');
        addRemoteTrack();
        await createAnswer(roomSnapshot, roomRef);
        remoteICE(roomRef, 'callerCandidates');
    } else {
        createPeerConnection();
        await addLocalStream();
        await createOffer(roomRef);
        collectLocalICE(roomRef, 'callerCandidates');
        remoteSessionDiscription(roomRef);
        addRemoteTrack();
        remoteICE(roomRef, 'calleeCandidates');
    }
}


async function hangUp(e) {
    const tracks = document.querySelector('#localVideo').srcObject.getTracks();
    tracks.forEach(track => {
        track.stop();
    });
    //leave room
    leave();



    document.location.reload();
}

async function leave() {
    if (remoteStream) {

        document.querySelector('#remoteVideo').srcObject = null;
        remoteStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection) {
        await peerConnection.close();
    }
    if (roomId) {
        const db = firebase.firestore();
        const roomRef = db.collection('rooms').doc(roomId);
        // const calleeCandidates = await roomRef.collection('calleeCandidates').get();
        // calleeCandidates.forEach(async candidate => {
        //     await roomRef.doc(candidate.id).delete();
        //     console.log(candidate.id);
        //     // await candidate.delete();
        // });
        // const callerCandidates = await roomRef.collection('callerCandidates').get();
        // callerCandidates.forEach(async candidate => {

        //     console.log(candidate.id);
        //     await candidate.delete();
        // });
        await roomRef.delete();
    }
}

function registerPeerConnectionListeners() {
    peerConnection.addEventListener('icegatheringstatechange', () => {
        console.log(`ICE gathering state changed: ${peerConnection.iceGatheringState}`);
    });

    peerConnection.addEventListener('connectionstatechange', async() => {
        console.log(`Connection state change: ${peerConnection.connectionState}`);
        switch (peerConnection.connectionState) {
            case "new":
            case "checking":
                break;
            case "connected":
                break;
            case "disconnected":
                await leave();
                await joinChat();
                break;
            case "closed":
                break;
            case "failed":
                break;
            default:
                break;
        }
    });

    peerConnection.addEventListener('signalingstatechange', () => {
        console.log(`Signaling state change: ${peerConnection.signalingState}`);
    });

    peerConnection.addEventListener('iceconnectionstatechange ', () => {
        console.log(`ICE connection state change: ${peerConnection.iceConnectionState}`);
    });
}

async function getRoomId() {
    return firebase.firestore().collection('rooms').doc().id;
}

function stopAudio() {
    if (document.querySelector('#micBtn').style.color == 'red')
        document.querySelector('#micBtn').style.color = 'white';
    else
        document.querySelector('#micBtn').style.color = 'red';
    localStream.getTracks()[0].enabled = !localStream.getTracks()[0].enabled;
}

function stopVideo() {
    if (document.querySelector('#cameraBtn').style.color == 'red')
        document.querySelector('#cameraBtn').style.color = 'white';
    else
        document.querySelector('#cameraBtn').style.color = 'red';
    localStream.getTracks()[1].enabled = !localStream.getTracks()[1].enabled;
}
async function joinChat() {
    await joinRoomById(window.location.pathname.slice(1, window.location.pathname.length));
}

async function init() {
    if (window.location.pathname == '/') {
        window.location.pathname = await getRoomId();
    }
}
init();