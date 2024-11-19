import { atom } from "nanostores";

interface User{
  userPhoto:string;
  userName:string;
  userEmail:string;
}

export const fecha = atom<Date>(new Date())
export const userData = atom<User>({userPhoto:'',userName:'',userEmail:''})
export const openReminderForm = atom<boolean>(false)