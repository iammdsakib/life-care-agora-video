import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AgoraClient, ClientEvent, NgxAgoraService, Stream, StreamEvent } from 'ngx-agora';
import { Subscription } from 'rxjs';
import { FormControl, FormGroup } from '@angular/forms';
import { Location } from '@angular/common';

interface Notify {
  mediaDenied: boolean;
  remoteLeft: boolean;
  waiting: boolean;
  ongoingMeeting: boolean;
}

@Component({
  selector: 'app-conference',
  templateUrl: './conference.component.html',
  styleUrls: ['./conference.component.scss']
})
export class ConferenceComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();
  streamRemoteCalls: string[] = [];
  localStreamId = 'local_user';
  joinCode = '';
  joinedMeeting = null;
  muteAudio = false;
  muteVideo = false;
  meetingDetails = '';

  notify: Notify = {
    mediaDenied: null,
    remoteLeft: null,
    waiting: true,
    ongoingMeeting: null,
  }

  form = new FormGroup({
    joinCodeField: new FormControl(''),
    nameField: new FormControl(''),
  });

  private uid = Math.floor(Math.random() * 100);
  private client: AgoraClient;
  private localClientStream: Stream;

  constructor(
    private agoraService: NgxAgoraService,
    private route: ActivatedRoute,
    private location: Location,
  ) { }

  ngOnInit() {
    this.subscriptions.add(
      this.route.params.subscribe((params) => {
        this.joinCode = params.code;
      }),
    );

    this.subscriptions.add(
      this.route.queryParams.subscribe((params) => {
        this.meetingDetails = params['details'] ? atob(params['details']) : '';
      }),
    );
  }

  ngOnDestroy(): void {
    if (this.joinedMeeting) {
      this.leaveMeeting();
    }
    this.subscriptions.unsubscribe();
  }

  joinMeeting() {
    if (!this.joinCode && !this.form.value.joinCodeField) {
      return;
    }
    if (!this.form.value.nameField) {
      this.form.controls.nameField.setValue('You');
    }
    this.joinCode = this.form.value.joinCodeField ? this.form.value.joinCodeField : this.joinCode;
    this.joinedMeeting = true;
    this.notify.ongoingMeeting = false;
    this.initiateMeeting();
  }

  initiateMeeting() {
    this.client = this.agoraService.createClient({ mode: 'rtc', codec: 'h264' });
    this.client.on(ClientEvent.PeerLeave, evt => {
      const stream = evt.stream as Stream;
      if (stream) {
        stream.stop();
        this.notify.remoteLeft = true;
        this.streamRemoteCalls = this.streamRemoteCalls.filter(call => call !== `${this.getRemoteStreamId(stream)}`);
      }
    });

    this.client.on(ClientEvent.RemoteStreamAdded, evt => {
      const streamRemote = evt.stream as Stream;
      this.client.subscribe(streamRemote, { audio: true, video: true }, () => {
        this.notify.waiting = true;
      });
    });

    this.client.on(ClientEvent.RemoteStreamRemoved, evt => {
      const streamRemote = evt.stream as Stream;
      if (streamRemote) {
        streamRemote.stop();
        this.notify.remoteLeft = true;
        this.streamRemoteCalls = [];
      }
    });

    this.client.on(ClientEvent.RemoteStreamSubscribed, evt => {
      const streamRemote = evt.stream as Stream;
      if (!this.streamRemoteCalls.length) {
        this.notify.remoteLeft = false;
        this.notify.waiting = false;
        const id = this.getRemoteStreamId(streamRemote);
        this.streamRemoteCalls.push(id);
        setTimeout(() => streamRemote.play(id), 1100);
      } else {
        this.leaveMeeting();
        // override below two props
        this.notify.ongoingMeeting = true;
        this.joinedMeeting = null;
      }
    });

    this.client.on(ClientEvent.Error, error => {
      if (error.reason === 'DYNAMIC_KEY_TIMEOUT') {
        this.client.renewChannelKey('');
      }
    });
    
    this.localClientStream = this.agoraService.createStream({ streamID: this.uid, audio: true, video: true, screen: false });
    this.localClientStream.on(StreamEvent.MediaAccessAllowed, () => {
      this.notify.mediaDenied = false;
    });

    this.localClientStream.on(StreamEvent.MediaAccessDenied, () => {
      this.notify.mediaDenied = true;
    });
    this.initializeLocalStream(() => this.join(() => this.client.publish(this.localClientStream)));
  }

  leaveMeeting() {
    this.agoraService.client.leave();
    this.localClientStream.close();
    this.streamRemoteCalls = [];
    this.form.controls.nameField.setValue('');
    this.joinCode = '';
    this.joinedMeeting = false;
    this.notify.ongoingMeeting = null;
    this.notify.remoteLeft = null;
    this.notify.waiting = true;
    this.notify.mediaDenied = false;
    this.location.go('/conference');
  }

  toggleAudio() {
    this.muteAudio ? this.localClientStream.unmuteAudio() : this.localClientStream.muteAudio();
    this.muteAudio = !this.muteAudio;
  }

  toggleVideo() {
    this.muteVideo ? this.localClientStream.unmuteVideo() : this.localClientStream.muteVideo();
    this.muteVideo = !this.muteVideo;
  }

  private join(onSuccess?: (uid: number | string) => void): void {
    this.client.join(null, this.joinCode, this.uid, onSuccess);
  }

  private getRemoteStreamId(stream: Stream): string {
    return `id: ${stream.getId()}`;
  }

  private initializeLocalStream(onSuccess?: () => any): void {
    this.localClientStream.init(
      () => {
        this.localClientStream.play(this.localStreamId);
        if (onSuccess) { onSuccess(); }
      }
    );
  }
}
