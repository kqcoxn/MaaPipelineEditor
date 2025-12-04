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

const IconZidingyishujuchuli: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M307.2 64m76.8 0l256 0q76.8 0 76.8 76.8l0 128q0 76.8-76.8 76.8l-256 0q-76.8 0-76.8-76.8l0-128q0-76.8 76.8-76.8Z"
        fill={getIconColor(color, 0, '#1989FA')}
        opacity=".3"
      />
      <path
        d="M307.2 371.2m76.8 0l256 0q76.8 0 76.8 76.8l0 128q0 76.8-76.8 76.8l-256 0q-76.8 0-76.8-76.8l0-128q0-76.8 76.8-76.8Z"
        fill={getIconColor(color, 1, '#1989FA')}
        opacity=".3"
      />
      <path
        d="M307.2 678.4m76.8 0l256 0q76.8 0 76.8 76.8l0 128q0 76.8-76.8 76.8l-256 0q-76.8 0-76.8-76.8l0-128q0-76.8 76.8-76.8Z"
        fill={getIconColor(color, 2, '#1989FA')}
        opacity=".3"
      />
      <path
        d="M823.5648 870.4H793.6a25.6 25.6 0 1 1 0-51.2h29.9648a76.8 76.8 0 1 1 0 51.2zM200.448 819.2H230.4a25.6 25.6 0 1 1 0 51.2h-29.9648a76.8 76.8 0 1 1 0-51.2zM823.552 550.4H793.6a25.6 25.6 0 1 1 0-51.2h29.9648a76.8 76.8 0 1 1 0 51.2zM200.448 499.2H230.4a25.6 25.6 0 1 1 0 51.2h-29.9648a76.8 76.8 0 1 1 0-51.2zM823.552 217.6H793.6a25.6 25.6 0 1 1 0-51.2h29.9648a76.8 76.8 0 1 1 0 51.2zM200.448 166.4H230.4a25.6 25.6 0 1 1 0 51.2h-29.9648a76.8 76.8 0 1 1 0-51.2z"
        fill={getIconColor(color, 3, '#1989FA')}
      />
      <path
        d="M409.6 192m19.2 0l166.4 0q19.2 0 19.2 19.2l0 0q0 19.2-19.2 19.2l-166.4 0q-19.2 0-19.2-19.2l0 0q0-19.2 19.2-19.2Z"
        fill={getIconColor(color, 4, '#1989FA')}
      />
      <path
        d="M409.6 499.2m19.2 0l166.4 0q19.2 0 19.2 19.2l0 0q0 19.2-19.2 19.2l-166.4 0q-19.2 0-19.2-19.2l0 0q0-19.2 19.2-19.2Z"
        fill={getIconColor(color, 5, '#1989FA')}
      />
      <path
        d="M409.6 806.4m19.2 0l166.4 0q19.2 0 19.2 19.2l0 0q0 19.2-19.2 19.2l-166.4 0q-19.2 0-19.2-19.2l0 0q0-19.2 19.2-19.2Z"
        fill={getIconColor(color, 6, '#1989FA')}
      />
    </svg>
  );
};

IconZidingyishujuchuli.defaultProps = {
  size: 18,
};

export default IconZidingyishujuchuli;
