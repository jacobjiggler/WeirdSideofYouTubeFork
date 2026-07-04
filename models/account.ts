import { Schema, model } from 'mongoose';
import passportLocalMongoose from 'passport-local-mongoose';

const Account = new Schema({
  username: String,
  email: String,
  time: { type: Date, default: Date.now },
  admin: { type: Boolean, default: false }
});

Account.plugin(passportLocalMongoose, { usernameLowerCase: true });

export = model('Account', Account);
