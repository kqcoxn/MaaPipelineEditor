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

const IconDaima: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M901.696 97.28c39.296 0 71.104 31.808 71.104 71.104V855.68c0 39.232-31.808 71.104-71.104 71.104H122.24A71.104 71.104 0 0 1 51.2 855.616V168.32c0-39.296 31.808-71.104 71.104-71.104z m-374.4 168.448a23.296 23.296 0 0 0-25.472 20.16l-59.712 441.728c-1.472 13.44 7.68 25.088 20.48 26.496l41.152 4.672a23.296 23.296 0 0 0 25.6-20.224l59.648-441.6 0.064-0.64a23.424 23.424 0 0 0-20.48-25.984zM351.552 382.08a23.04 23.04 0 0 0-32.256 0.64L194.944 509.44a23.68 23.68 0 0 0 0 33.088l124.288 126.72a23.04 23.04 0 0 0 32.256 0.64l29.12-27.328a23.808 23.808 0 0 0 0.832-33.664L301.376 525.952l80-82.88a23.808 23.808 0 0 0-0.768-33.664z m320.832 0l-29.12 27.328a23.808 23.808 0 0 0-0.832 33.664l80.128 82.88-80.128 82.944-0.384 0.448a23.68 23.68 0 0 0 1.28 33.216l29.056 27.328a23.04 23.04 0 0 0 32.256-0.64l124.352-126.72a23.68 23.68 0 0 0 0-33.088l-124.352-126.72a23.04 23.04 0 0 0-32.256-0.64z"
        fill={getIconColor(color, 0, '#4E5969')}
      />
    </svg>
  );
};

IconDaima.defaultProps = {
  size: 18,
};

export default IconDaima;
