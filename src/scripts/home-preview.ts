import { evaluate } from '../components/lab/thermal-stack/evaluator';
import { DEFAULT_PARAMS } from '../components/lab/thermal-stack/parameters';

class HomeThermalPreview extends HTMLElement {
  connectedCallback() {
    if (this.dataset.enhanced) return;
    const slider = this.querySelector<HTMLInputElement>('input[type="range"]');
    const temperature = this.querySelector<HTMLOutputElement>('[data-home-tj]');
    const thickness = this.querySelector<HTMLElement>('[data-home-thickness]');
    const announcement = this.querySelector<HTMLElement>('[data-home-announcement]');
    if (!slider || !temperature || !thickness || !announcement) return;
    const update = (announce: boolean) => {
      const value = slider.valueAsNumber;
      const result = evaluate({ ...DEFAULT_PARAMS, t_cer: value }, { includeField: false });
      temperature.value = result.tjMax.toFixed(1);
      thickness.textContent = value.toFixed(2);
      slider.setAttribute('aria-valuetext', `${value.toFixed(2)} mm`);
      if (announce)
        announcement.textContent = `${this.dataset.temperatureLabel}: ${temperature.value} °C`;
    };
    slider.addEventListener('input', () => update(false));
    slider.addEventListener('change', () => update(true));
    this.dataset.enhanced = 'true';
    slider.disabled = false;
  }
}
if (!customElements.get('home-thermal-preview'))
  customElements.define('home-thermal-preview', HomeThermalPreview);
