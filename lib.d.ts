import {Aos} from 'aos';
import SwiperClass from 'swiper';
import JQuery from 'jquery';
import fancybox from '@types/fancybox';

declare global {
  var AOS: Aos;
  var $: JQuery;
  var fancybox: fancybox;
  declare class Swiper extends SwiperClass {}
}
