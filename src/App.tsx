import './App.css';
import { useEffect } from 'react';
import { bitable, UIBuilder } from "@lark-base-open/js-sdk";
import callback from './runUIBuilder';

export default function App() {
  useEffect(() => {
    const uiBuilder = new UIBuilder(document.querySelector('#container') as HTMLElement, { bitable, callback });
    return () => {
      uiBuilder.umount();
    }
  }, []);
  return (
    <div id='container'></div>
  );
}