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

const IconShanchu: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1026 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M513.184512 0.001536v102.399744a409.598976 409.598976 0 0 1 70.143825 813.565966A434.686913 434.686913 0 0 1 513.184512 921.599232 409.598976 409.598976 0 0 1 443.040687 108.033266 435.198912 435.198912 0 0 1 513.184512 102.40128V0.001536m0 0a536.06266 536.06266 0 0 0-86.527784 7.167982A511.99872 511.99872 0 0 0 513.184512 1023.998976a535.550661 535.550661 0 0 0 86.527784-7.167982A511.99872 511.99872 0 0 0 513.184512 0.001536z"
        fill={getIconColor(color, 0, '#606060')}
      />
      <path
        d="M717.984 588.800064H308.385024a51.199872 51.199872 0 0 1 0-102.399744h409.598976a51.199872 51.199872 0 0 1 0 102.399744z"
        fill={getIconColor(color, 1, '#606060')}
      />
    </svg>
  );
};

IconShanchu.defaultProps = {
  size: 18,
};

export default IconShanchu;
