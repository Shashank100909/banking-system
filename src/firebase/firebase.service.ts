import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
    private app: admin.app.App;

    onModuleInit() {
        this.app = admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
        });
    }

    async sendPushNotification(
        token: string,
        title: string,
        body: string,
        data?: Record<string, string>,
    ) {
        try {
            return await admin.messaging().send({
                token,
                notification: { title, body },
                data,
            });
        } catch (error) {
            console.error(`FCM send failed:`, error.message);
           
        }
    }
}