/* tslint:disable */
/* eslint-disable */

import React, { CSSProperties, SVGAttributes, FunctionComponent } from 'react';
import { getIconColor } from './helper';

interface Props extends Omit<SVGAttributes<SVGElement>, 'color'> {
  size?: number;
  color?: string | string[];
}

const DEFAULT_STYLE: CSSProperties = {
  display: 'block',
};

const IconNiantie1: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M704 222.208h-76.8v-30.0032a12.8 12.8 0 0 0-12.8-12.8v-76.8c49.4592 0 89.6 40.1408 89.6 89.6v30.0032z m0 166.1952h-76.8v-102.4h76.8v102.4z m0 204.8h-76.8v-102.4h76.8v102.4z m-149.3504 161.9968l-0.4608-76.8 61.7984-0.1024a12.8 12.8 0 0 0 9.0624-5.5296l63.5392 43.008c-14.4384 21.3504-37.4272 35.6352-67.7376 39.0656l-66.2016 0.3584z m-205.056 0v-76.8h102.4v76.8h-102.4z m-229.888-61.44l72.9088-24.1152A12.8 12.8 0 0 0 204.8 678.4h42.3936v76.8H204.8a89.6 89.6 0 0 1-85.0944-61.44zM115.2 490.752h76.8v102.4h-76.8v-102.4z m0.6144-187.904h76.8v102.4h-76.8v-102.4z m106.5472-200.2944v76.8H204.8a12.8 12.8 0 0 0-12.8 12.8v12.4416h-76.8v-12.4416c0-49.4592 40.1408-89.6 89.6-89.6h17.5616z m204.8 0v76.8h-102.4v-76.8h102.4z m187.2384 0v76.8h-84.8384v-76.8H614.4z"
        fill={getIconColor(color, 0, '#05A8A8')}
      />
      <path
        d="M307.2 256m51.2 0l460.8 0q51.2 0 51.2 51.2l0 563.2q0 51.2-51.2 51.2l-460.8 0q-51.2 0-51.2-51.2l0-563.2q0-51.2 51.2-51.2Z"
        fill={getIconColor(color, 1, '#05A8A8')}
      />
    </svg>
  );
};

IconNiantie1.defaultProps = {
  size: 18,
};

export default IconNiantie1;
