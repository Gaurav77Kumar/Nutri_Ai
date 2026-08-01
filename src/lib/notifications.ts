/**
 *  Hybrid Notification System
 * 
 * Works on BOTH:
 * -  Android (Capacitor) → Real native notifications in system tray
 * -  Web (Browser) → Browser notification API as fallback
 * 
 * Uses @capacitor/local-notifications (FREE, no Firebase needed)
 */

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";

const isNative = Capacitor.isNativePlatform();


export async function initPushNotifications() {
  if (!isNative) return;

  try {
    const result = await PushNotifications.requestPermissions();
    if (result.receive === 'granted') {
      await PushNotifications.register();
    } else {
      console.warn("Push permissions not granted");
      return;
    }

    PushNotifications.addListener('registration', (token) => {
      console.log('🔥 Firebase Push Token: ', token.value);
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('Error on push registration: ', JSON.stringify(error));
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received: ', notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push action performed: ', notification);
    });
  } catch (error) {
    console.error("Failed to init push notifications", error);
  }
}

// Permission 
export async function requestNotificationPermission(): Promise<boolean> {
  if (isNative) {
    const result = await LocalNotifications.requestPermissions();
    return result.display === "granted";
  } else {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
}

export async function isNotificationEnabled(): Promise<boolean> {
  if (isNative) {
    const result = await LocalNotifications.checkPermissions();
    return result.display === "granted";
  }
  return typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";
}

//  Send Immediate Notification 
let notifIdCounter = 100;

export async function sendNotification(title: string, body: string) {
  if (isNative) {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notifIdCounter++,
          title,
          body,
          smallIcon: "ic_stat_nutriai",
          largeIcon: "ic_launcher",
          sound: "default",
        },
      ],
    });
  } else {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    new Notification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    });
  }
}

// Schedule Daily Meal Reminders (Native Only) 
export async function scheduleMealReminders() {
  if (!isNative) {
    scheduleWebReminders();
    return;
  }

  await LocalNotifications.cancel({ notifications: [
    { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 },
  ]});

  const now = new Date();

  const schedules = [
    { id: 1, hour: 8, minute: 30, title: "🌅 Good Morning!", body: "Don't forget to log your breakfast. Start tracking!" },
    { id: 2, hour: 13, minute: 0, title: "☀️ Lunch Time!", body: "Had your lunch? Log it to keep your calories on track." },
    { id: 3, hour: 16, minute: 30, title: "🍪 Chai Break?", body: "Had a snack or chai? Quick-log it for accuracy!" },
    { id: 4, hour: 20, minute: 0, title: "🌙 Dinner Check-in", body: "Log your dinner and complete today's nutrition tracking!" },
  ];

  const notifications = schedules.map((s) => {
    const scheduleDate = new Date();
    scheduleDate.setHours(s.hour, s.minute, 0, 0);

    if (scheduleDate <= now) {
      scheduleDate.setDate(scheduleDate.getDate() + 1);
    }

    return {
      id: s.id,
      title: s.title,
      body: s.body,
      schedule: {
        at: scheduleDate,
        repeats: true,
        every: "day" as const,
      },
      smallIcon: "ic_stat_nutriai",
      sound: "default",
    };
  });

  await LocalNotifications.schedule({ notifications });
  console.log(" Meal reminders scheduled (native)");
}

// Preset Notifications
export async function notifyMealReminder(mealType: "breakfast" | "lunch" | "snack" | "dinner") {
  const messages: Record<string, { title: string; body: string }> = {
    breakfast: { title: "🌅 Good Morning!", body: "Log your breakfast to start the day right!" },
    lunch: { title: "☀️ Lunch Time!", body: "Had your lunch? Log it now to stay on track." },
    snack: { title: "🍪 Snack Check", body: "Had chai or a snack? Quick-log it!" },
    dinner: { title: "🌙 Dinner Time", body: "Log dinner to complete today's tracking!" },
  };
  const msg = messages[mealType];
  await sendNotification(msg.title, msg.body);
}

export async function notifyStreakAchievement(days: number) {
  await sendNotification("🔥 Streak Milestone!", `Amazing! You've tracked for ${days} days straight. Keep it up!`);
}
export async function notifyGoalReached(nutrient: string) {
  await sendNotification("🎯 Goal Reached!", `You've hit your ${nutrient} target for today. Great job!`);
}

// Web-only Scheduled Reminders (setTimeout)
let reminderTimers: ReturnType<typeof setTimeout>[] = [];

function scheduleWebReminders() {
  reminderTimers.forEach(clearTimeout);
  reminderTimers = [];

  const now = new Date();
  const schedules = [
    { hour: 8, minute: 30, meal: "breakfast" as const },
    { hour: 13, minute: 0, meal: "lunch" as const },
    { hour: 16, minute: 30, meal: "snack" as const },
    { hour: 20, minute: 0, meal: "dinner" as const },
  ];

  schedules.forEach(({ hour, minute, meal }) => {
    const target = new Date();
    target.setHours(hour, minute, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);

    const msUntil = target.getTime() - now.getTime();
    const timer = setTimeout(() => {
      notifyMealReminder(meal);
      scheduleWebReminders();
    }, msUntil);

    reminderTimers.push(timer);
  });
  console.log(" Meal reminders scheduled (web fallback)");
}


export async function initNotifications() {
  const granted = await requestNotificationPermission();
  if (granted) {
    await scheduleMealReminders();
    await initPushNotifications(); 
  }
  return granted;
}

export function cancelAllReminders() {
  if (isNative) {
    LocalNotifications.cancel({ notifications: [
      { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 },
    ]});
  }
  reminderTimers.forEach(clearTimeout);
  reminderTimers = [];
}
