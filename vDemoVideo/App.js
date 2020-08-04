/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  Dimensions,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  MediaStreamTrack,
  mediaDevices,
  registerGlobals
} from 'react-native-webrtc';

import io from 'socket.io-client'

const dimensions = Dimensions.get('window')

class App extends React.Component  {
  constructor(props) {
    super(props)

    this.state = {
      localStream: null,
      remoteStream: null,
    }

    this.sdp
    this.socket = null
    this.candidates = []
  }

  componentDidMount = () => {

    this.socket = io.connect(
      'https://2abed26d3b92.ngrok.io/webrtcPeer',
      {
        path: '/io/webrtc',
        query: {}
      }
    )

    this.socket.on('connection-success', success => {
      console.log(success)
    })

    this.socket.on('offerOrAnswer', sdp => {
      this.sdp = JSON.stringify(sdp)

      this.pc.setRemoteDescription(new RTCSessionDescription(sdp))
    })

    this.socket.on('candidate', candidate => {
      this.pc.addIceCandidate(new RTCIceCandidate(candidate))
    })

    const pc_config = {
      "iceServers": [
        {
          urls: 'stun:stun.l.google.com:19302'
        }
      ]
    }

    this.pc = new RTCPeerConnection(pc_config)

    this.pc.onicecandidate = e => {
      if (e.candidate) {
        this.sendToPeer('candidate', e.candidate)
      }
    }

    this.pc.oniceconnectionstatechange = e => {
      console.log(e)
    }

    this.pc.onaddstream = e => {
      this.setState({
        remoteStream: e.stream
      })
    }

    const success = (stream) => {
      this.setState({
        localStream: stream
      })
      this.pc.addStream(stream)
    }

    const failure = (e) => {
      console.log('Erroe', e)
    }

    let isFront = true;
    mediaDevices.enumerateDevices().then(sourceInfos => {
      console.log(sourceInfos);
      let videoSourceId;
      for (let i = 0; i < sourceInfos.length; i++) {
        const sourceInfo = sourceInfos[i];
        if (sourceInfo.kind == "videoinput" && sourceInfo.facing == (isFront ? "front" : "environment")) {
          videoSourceId = sourceInfo.deviceId;
        }
      }

      const constraints = {
        audio: true,
        video: {
          mandatory: {
            minWidth: 500,
            minHeight: 300,
            minFrameRate: 30
          },
          facingMode: (isFront ? "user" : "environment"),
          optional: (videoSourceId ? [{ sourceId: videoSourceId }] : [])
        }
      }

      mediaDevices.getUserMedia(constraints)
        .then(success)
        .catch(failure);
    });
  }

  sendToPeer = (messageType, payload) => {
    this.socket.emit(messageType, {
      socketID: this.socket.id,
      payload
    })
  }

  createOffer = () => {
    console.log('Offer')
    this.pc.createOffer({offerToReceiveVideo: 1})
      .then(sdp => {
        // console.log(JSON.stringify(sdp))
        this.pc.setLocalDescription(sdp)

        this.sendToPeer('offerOrAnswer', sdp)
      })
  }

  createAnswer = () => {
    console.log('Answer')
    this.pc.createAnswer({offerToReceiveVideo: 1})
      .then(sdp => {
        // console.log(JSON.stringify(sdp))
        this.pc.setLocalDescription(sdp)

        this.sendToPeer('offerOrAnswer', sdp)
      })
  }

  setRemoteDescription = () => {
    const desc = JSON.parse(this.sdp)

    this.pc.setRemoteDescription(new RTCSessionDescription(desc))
  }

  addCandidate =() => {
    this.candidates.forEach(candidate => {
      console.log(JSON.stringify(candidate))
      this.pc.addIceCandidate(new RTCIceCandidate(candidate))
    });
  }

  render() {
    const {localStream, remoteStream} = this.state

    const remoteVideo = remoteStream ? 
      (
        <RTCView 
          key={2}
          mirror={true}
          objectFit='contain'
          streamURL={remoteStream && remoteStream.toURL()}
          style={{...styles.rtcViewRemote}}
          />
      ) : 
      (
        <View style={{padding: 15}}>
          <Text style={{fontSize: 22, textAlign: 'center', color: 'white'}}>Waiting for Peer connection...</Text>
        </View>
      )

    return (
        <SafeAreaView style={{flex: 1}}>
          <View style={{...styles.buttonsContainer}}>
            <View style={{flex: 1}}>
              <TouchableOpacity onPress={this.createOffer}>
                <View style={styles.button}>
                  <Text style={{...styles.textContent, }}>Call</Text>
                </View>
              </TouchableOpacity>
            </View>
            <View style={{flex: 1}}>
              <TouchableOpacity onPress={this.createAnswer}>
                <View style={styles.button}>
                  <Text style={{...styles.textContent, }}>Answer</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
          <View style={{...styles.videosContainer}}>
            <ScrollView style={{ ...styles.scrollView }}>
              <View style={{
                flex: 1,
                width: '100%',
                backgroundColor: 'black',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                {remoteVideo}
              </View>
            </ScrollView>
            <View style={styles.localVideo}>

              <View style={{ flex: 1 }}>
                <TouchableOpacity onPress={() => localStream._tracks[1]._switchCamera()}>
                  <View>
                    <RTCView
                      key={1}
                      zOrder={0}
                      objectFit='cover'
                      style={{ ...styles.rtcView }}
                      streamURL={localStream && localStream.toURL()}
                    />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
    );
  }
};

const styles = StyleSheet.create({
  buttonsContainer: {
    flexDirection: 'row',
  },
  button: {
    margin: 5,
    paddingVertical: 10,
    backgroundColor: '#388244',
    borderRadius: 5,
  },
  textContent: {
    fontFamily: 'Avenir',
    fontSize: 20,
    textAlign: 'center',
    color: 'white',
  },
  videosContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  localVideo: {
    position: 'absolute',
    backgroundColor: 'black',
    width: dimensions.width - 35,
    height: 200,
    bottom: 10,
    right: 20,
    zIndex: 1000
  },
  rtcView: {
    width: '100%',
    height: 200,
    backgroundColor: 'black',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#CFFCD6',
    padding: 15,
  },
  remoteVideoStyle: {
    flex: 1,
    width: '100%',
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rtcViewRemote: {
    width: dimensions.width - 30,
    height: dimensions.height / 1.8,
    backgroundColor: 'black',
  },
});

export default App;
