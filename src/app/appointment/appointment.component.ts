import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-appointment',
  templateUrl: './appointment.component.html',
  styleUrls: ['./appointment.component.scss']
})
export class AppointmentComponent implements OnInit {
  private code = Math.floor(Math.random() * (99999 - 11111 + 1)) + 11111;
  copied = false;

  form = new FormGroup({
    code: new FormControl(),
    title: new FormControl(''),
    creator: new FormControl(''),
    time: new FormControl(new Date()),
  });

  get getLink(): string {
    return window.location.origin + '/conference/' + this.form.value.code
      + '?details=' + btoa(this.form.value.title + (this.form.value.creator ? ' - ' + this.form.value.creator : ''));
  }

  constructor() { }

  ngOnInit() {
  }

  createMeeting() {
    this.form.controls.code.setValue(this.code);
    this.form.controls.time.setValue(new Date(this.form.controls.time.value));

    if (!this.form.value.title) {
      this.form.controls.title.setValue('My Appointment');
    }
  }

  copyToClipboard(val: string) {
    const selBox = document.createElement('textarea');
    selBox.style.position = 'fixed';
    selBox.style.left = '0';
    selBox.style.top = '0';
    selBox.style.opacity = '0';
    selBox.value = val;
    document.body.appendChild(selBox);
    selBox.focus();
    selBox.select();
    document.execCommand('copy');
    document.body.removeChild(selBox);

    this.copied = true;
    setTimeout(() => {
      this.copied = false;
    }, 3000);
  }
}
