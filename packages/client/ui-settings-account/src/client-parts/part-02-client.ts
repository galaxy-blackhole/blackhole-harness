/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc MẢNH DE-BUNDLE 3/N: lát NGUYÊN VĂN của @deepseek-ai/dsh-client-ui-settings-account/lib/client.js (tách theo dòng
 *      để giữ luật ≤1000 dòng/tệp; nối lại theo thứ tự tên tệp là ra bản gốc từng byte). KHÔNG sửa tay.
 */
// @ts-nocheck
					owner = onClose;
					store.set({ page });
					previous?.("superseded");
					return () => {
						if (token !== own) return;
						token = null;
						owner = void 0;
						store.set(null);
					};
				},
				close() {
					if (store.getSnapshot() === null) return;
					const retiring = owner;
					token = null;
					owner = void 0;
					store.set(null);
					retiring?.("returned");
				},
				dispose() {
					token = null;
					owner = void 0;
					if (store.getSnapshot() === null) return;
					store.set(null);
				}
			};
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/big.js@7.0.1/node_modules/big.js/big.mjs
		/************************************** EDITABLE DEFAULTS *****************************************/
		var DP = 20, RM = 1, MAX_DP = 1e6, MAX_POWER = 1e6, NE = -7, PE = 21, STRICT = false, NAME = "[big.js] ", INVALID = NAME + "Invalid ", INVALID_DP = INVALID + "decimal places", INVALID_RM = INVALID + "rounding mode", DIV_BY_ZERO = NAME + "Division by zero", P = {}, UNDEFINED = void 0, NUMERIC = /^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;
		function _Big_() {
			function Big(n) {
				var x = this;
				if (!(x instanceof Big)) return n === UNDEFINED && arguments.length === 0 ? _Big_() : new Big(n);
				if (n instanceof Big) {
					x.s = n.s;
					x.e = n.e;
					x.c = n.c.slice();
				} else {
					if (typeof n !== "string") {
						if (Big.strict === true && typeof n !== "bigint") throw TypeError(INVALID + "value");
						n = n === 0 && 1 / n < 0 ? "-0" : String(n);
					}
					parse(x, n);
				}
				x.constructor = Big;
			}
			Big.prototype = P;
			Big.DP = DP;
			Big.RM = RM;
			Big.NE = NE;
			Big.PE = PE;
			Big.strict = STRICT;
			Big.roundDown = 0;
			Big.roundHalfUp = 1;
			Big.roundHalfEven = 2;
			Big.roundUp = 3;
			return Big;
		}
		function parse(x, n) {
			var e, i, nl;
			if (!NUMERIC.test(n)) throw Error(INVALID + "number");
			x.s = n.charAt(0) == "-" ? (n = n.slice(1), -1) : 1;
			if ((e = n.indexOf(".")) > -1) n = n.replace(".", "");
			if ((i = n.search(/e/i)) > 0) {
				if (e < 0) e = i;
				e += +n.slice(i + 1);
				n = n.substring(0, i);
			} else if (e < 0) e = n.length;
			nl = n.length;
			for (i = 0; i < nl && n.charAt(i) == "0";) ++i;
			if (i == nl) x.c = [x.e = 0];
			else {
				for (; nl > 0 && n.charAt(--nl) == "0";);
				x.e = e - i - 1;
				x.c = [];
				for (e = 0; i <= nl;) x.c[e++] = +n.charAt(i++);
			}
			return x;
		}
		function round(x, sd, rm, more) {
			var xc = x.c;
			if (rm === UNDEFINED) rm = x.constructor.RM;
			if (rm !== 0 && rm !== 1 && rm !== 2 && rm !== 3) throw Error(INVALID_RM);
			if (sd < 1) {
				more = rm === 3 && (more || !!xc[0]) || sd === 0 && (rm === 1 && xc[0] >= 5 || rm === 2 && (xc[0] > 5 || xc[0] === 5 && (more || xc[1] !== UNDEFINED)));
				xc.length = 1;
				if (more) {
					x.e = x.e - sd + 1;
					xc[0] = 1;
				} else xc[0] = x.e = 0;
			} else if (sd < xc.length) {
				more = rm === 1 && xc[sd] >= 5 || rm === 2 && (xc[sd] > 5 || xc[sd] === 5 && (more || xc[sd + 1] !== UNDEFINED || xc[sd - 1] & 1)) || rm === 3 && (more || !!xc[0]);
				xc.length = sd;
				if (more) for (; ++xc[--sd] > 9;) {
					xc[sd] = 0;
					if (sd === 0) {
						++x.e;
						xc.unshift(1);
						break;
					}
				}
				for (sd = xc.length; !xc[--sd];) xc.pop();
			}
			return x;
		}
		function stringify(x, doExponential, isNonzero) {
			var e = x.e, s = x.c.join(""), n = s.length;
			if (doExponential) s = s.charAt(0) + (n > 1 ? "." + s.slice(1) : "") + (e < 0 ? "e" : "e+") + e;
			else if (e < 0) {
				for (; ++e;) s = "0" + s;
				s = "0." + s;
			} else if (e > 0) {
				if (++e > n) for (e -= n; e--;) s += "0";
				else if (e < n) s = s.slice(0, e) + "." + s.slice(e);
			} else if (n > 1) s = s.charAt(0) + "." + s.slice(1);
			return x.s < 0 && isNonzero ? "-" + s : s;
		}
		P.abs = function() {
			var x = new this.constructor(this);
			x.s = 1;
			return x;
		};
		P.cmp = function(y) {
			var isneg, x = this, xc = x.c, yc = (y = new x.constructor(y)).c, i = x.s, j = y.s, k = x.e, l = y.e;
			if (!xc[0] || !yc[0]) return !xc[0] ? !yc[0] ? 0 : -j : i;
			if (i != j) return i;
			isneg = i < 0;
			if (k != l) return k > l ^ isneg ? 1 : -1;
			j = (k = xc.length) < (l = yc.length) ? k : l;
			for (i = -1; ++i < j;) if (xc[i] != yc[i]) return xc[i] > yc[i] ^ isneg ? 1 : -1;
			return k == l ? 0 : k > l ^ isneg ? 1 : -1;
		};
		P.div = function(y) {
			var x = this, Big = x.constructor, a = x.c, b = (y = new Big(y)).c, k = x.s == y.s ? 1 : -1, dp = Big.DP;
			if (dp !== ~~dp || dp < 0 || dp > MAX_DP) throw Error(INVALID_DP);
			if (!b[0]) throw Error(DIV_BY_ZERO);
			if (!a[0]) {
				y.s = k;
				y.c = [y.e = 0];
				return y;
			}
			var bl, bt, n, cmp, ri, bz = b.slice(), ai = bl = b.length, al = a.length, r = a.slice(0, bl), rl = r.length, q = y, qc = q.c = [], qi = 0, p = dp + (q.e = x.e - y.e) + 1;
			q.s = k;
			k = p < 0 ? 0 : p;
			bz.unshift(0);
			for (; rl++ < bl;) r.push(0);
			do {
				for (n = 0; n < 10; n++) {
					if (bl != (rl = r.length)) cmp = bl > rl ? 1 : -1;
					else for (ri = -1, cmp = 0; ++ri < bl;) if (b[ri] != r[ri]) {
						cmp = b[ri] > r[ri] ? 1 : -1;
						break;
					}
					if (cmp < 0) {
						for (bt = rl == bl ? b : bz; rl;) {
							if (r[--rl] < bt[rl]) {
								ri = rl;
								for (; ri && !r[--ri];) r[ri] = 9;
								--r[ri];
								r[rl] += 10;
							}
							r[rl] -= bt[rl];
						}
						for (; !r[0];) r.shift();
					} else break;
				}
				qc[qi++] = cmp ? n : ++n;
				if (r[0] && cmp) r[rl] = a[ai] || 0;
				else r = [a[ai]];
			} while ((ai++ < al || r[0] !== UNDEFINED) && k--);
			if (!qc[0] && qi != 1) {
				qc.shift();
				q.e--;
				p--;
			}
			if (qi > p) round(q, p, Big.RM, r[0] !== UNDEFINED);
			return q;
		};
		P.eq = function(y) {
			return this.cmp(y) === 0;
		};
		P.gt = function(y) {
			return this.cmp(y) > 0;
		};
		P.gte = function(y) {
			return this.cmp(y) > -1;
		};
		P.lt = function(y) {
			return this.cmp(y) < 0;
		};
		P.lte = function(y) {
			return this.cmp(y) < 1;
		};
		P.minus = P.sub = function(y) {
			var i, j, t, xlty, x = this, Big = x.constructor, a = x.s, b = (y = new Big(y)).s;
			if (a != b) {
				y.s = -b;
				return x.plus(y);
			}
			var xc = x.c.slice(), xe = x.e, yc = y.c, ye = y.e;
			if (!xc[0] || !yc[0]) {
				if (yc[0]) y.s = -b;
				else if (xc[0]) y = new Big(x);
				else y.s = 1;
				return y;
			}
			if (a = xe - ye) {
				if (xlty = a < 0) {
					a = -a;
					t = xc;
				} else {
					ye = xe;
					t = yc;
				}
				t.reverse();
				for (b = a; b--;) t.push(0);
				t.reverse();
			} else {
				j = ((xlty = xc.length < yc.length) ? xc : yc).length;
				for (a = b = 0; b < j; b++) if (xc[b] != yc[b]) {
					xlty = xc[b] < yc[b];
					break;
				}
			}
			if (xlty) {
				t = xc;
				xc = yc;
				yc = t;
				y.s = -y.s;
			}
			if ((b = (j = yc.length) - (i = xc.length)) > 0) for (; b--;) xc[i++] = 0;
			for (b = i; j > a;) {
				if (xc[--j] < yc[j]) {
					for (i = j; i && !xc[--i];) xc[i] = 9;
					--xc[i];
					xc[j] += 10;
				}
				xc[j] -= yc[j];
			}
			for (; xc[--b] === 0;) xc.pop();
			for (; xc[0] === 0;) {
				xc.shift();
				--ye;
			}
			if (!xc[0]) {
				y.s = 1;
				xc = [ye = 0];
			}
			y.c = xc;
			y.e = ye;
			return y;
		};
		P.mod = function(y) {
			var ygtx, x = this, Big = x.constructor, a = x.s, b = (y = new Big(y)).s;
			if (!y.c[0]) throw Error(DIV_BY_ZERO);
			x.s = y.s = 1;
			ygtx = y.cmp(x) == 1;
			x.s = a;
			y.s = b;
			if (ygtx) return new Big(x);
			a = Big.DP;
			b = Big.RM;
			Big.DP = Big.RM = 0;
			x = x.div(y);
			Big.DP = a;
			Big.RM = b;
			return this.minus(x.times(y));
		};
		P.neg = function() {
			var x = new this.constructor(this);
			x.s = -x.s;
			return x;
		};
		P.plus = P.add = function(y) {
			var e, k, t, x = this, Big = x.constructor;
			y = new Big(y);
			if (x.s != y.s) {
				y.s = -y.s;
				return x.minus(y);
			}
			var xe = x.e, xc = x.c, ye = y.e, yc = y.c;
			if (!xc[0] || !yc[0]) {
				if (!yc[0]) if (xc[0]) y = new Big(x);
				else y.s = x.s;
				return y;
			}
			xc = xc.slice();
			if (e = xe - ye) {
				if (e > 0) {
					ye = xe;
					t = yc;
				} else {
					e = -e;
					t = xc;
				}
				t.reverse();
				for (; e--;) t.push(0);
				t.reverse();
			}
			if (xc.length - yc.length < 0) {
				t = yc;
				yc = xc;
				xc = t;
			}
			e = yc.length;
			for (k = 0; e; xc[e] %= 10) k = (xc[--e] = xc[e] + yc[e] + k) / 10 | 0;
			if (k) {
				xc.unshift(k);
				++ye;
			}
			for (e = xc.length; xc[--e] === 0;) xc.pop();
			y.c = xc;
			y.e = ye;
			return y;
		};
		P.pow = function(n) {
			var x = this, one = new x.constructor("1"), y = one, isneg = n < 0;
			if (n !== ~~n || n < -MAX_POWER || n > MAX_POWER) throw Error(INVALID + "exponent");
			if (isneg) n = -n;
			for (;;) {
				if (n & 1) y = y.times(x);
				n >>= 1;
				if (!n) break;
				x = x.times(x);
			}
			return isneg ? one.div(y) : y;
		};
		P.prec = function(sd, rm) {
			if (sd !== ~~sd || sd < 1 || sd > MAX_DP) throw Error(INVALID + "precision");
			return round(new this.constructor(this), sd, rm);
		};
		P.round = function(dp, rm) {
			if (dp === UNDEFINED) dp = 0;
			else if (dp !== ~~dp || dp < -MAX_DP || dp > MAX_DP) throw Error(INVALID_DP);
			return round(new this.constructor(this), dp + this.e + 1, rm);
		};
		P.sqrt = function() {
			var r, c, t, x = this, Big = x.constructor, s = x.s, e = x.e, half = new Big("0.5");
			if (!x.c[0]) return new Big(x);
			if (s < 0) throw Error(NAME + "No square root");
			s = Math.sqrt(+stringify(x, true, true));
			if (s === 0 || s === Infinity) {
				c = x.c.join("");
				if (!(c.length + e & 1)) c += "0";
				s = Math.sqrt(c);
				e = ((e + 1) / 2 | 0) - (e < 0 || e & 1);
				r = new Big((s == Infinity ? "5e" : (s = s.toExponential()).slice(0, s.indexOf("e") + 1)) + e);
			} else r = new Big(s + "");
			e = r.e + (Big.DP += 4);
			do {
				t = r;
				r = half.times(t.plus(x.div(t)));
			} while (t.c.slice(0, e).join("") !== r.c.slice(0, e).join(""));
			return round(r, (Big.DP -= 4) + r.e + 1, Big.RM);
		};
		P.times = P.mul = function(y) {
			var c, x = this, Big = x.constructor, xc = x.c, yc = (y = new Big(y)).c, a = xc.length, b = yc.length, i = x.e, j = y.e;
			y.s = x.s == y.s ? 1 : -1;
			if (!xc[0] || !yc[0]) {
				y.c = [y.e = 0];
				return y;
			}
			y.e = i + j;
			if (a < b) {
				c = xc;
				xc = yc;
				yc = c;
				j = a;
				a = b;
				b = j;
			}
			for (c = new Array(j = a + b); j--;) c[j] = 0;
			for (i = b; i--;) {
				b = 0;
				for (j = a + i; j > i;) {
					b = c[j] + yc[i] * xc[j - i - 1] + b;
					c[j--] = b % 10;
					b = b / 10 | 0;
				}
				c[j] = b;
			}
			if (b) ++y.e;
			else c.shift();
			for (i = c.length; !c[--i];) c.pop();
			y.c = c;
			return y;
		};
		P.toExponential = function(dp, rm) {
			var x = this, n = x.c[0];
			if (dp !== UNDEFINED) {
				if (dp !== ~~dp || dp < 0 || dp > MAX_DP) throw Error(INVALID_DP);
				x = round(new x.constructor(x), ++dp, rm);
				for (; x.c.length < dp;) x.c.push(0);
			}
			return stringify(x, true, !!n);
		};
		P.toFixed = function(dp, rm) {
			var x = this, n = x.c[0];
			if (dp !== UNDEFINED) {
				if (dp !== ~~dp || dp < 0 || dp > MAX_DP) throw Error(INVALID_DP);
				x = round(new x.constructor(x), dp + x.e + 1, rm);
				for (dp = dp + x.e + 1; x.c.length < dp;) x.c.push(0);
			}
			return stringify(x, false, !!n);
		};
		P.toJSON = P.toString = function() {
			var x = this, Big = x.constructor;
			return stringify(x, x.e <= Big.NE || x.e >= Big.PE, !!x.c[0]);
		};
		if (typeof Symbol !== "undefined") P[Symbol.for("nodejs.util.inspect.custom")] = P.toJSON;
		P.toNumber = function() {
			var n = +stringify(this, true, true);
			if (this.constructor.strict === true && !this.eq(n.toString())) throw Error(NAME + "Imprecise conversion");
			return n;
		};
		P.toPrecision = function(sd, rm) {
			var x = this, Big = x.constructor, n = x.c[0];
			if (sd !== UNDEFINED) {
				if (sd !== ~~sd || sd < 1 || sd > MAX_DP) throw Error(INVALID + "precision");
				x = round(new Big(x), sd, rm);
				for (; x.c.length < sd;) x.c.push(0);
			}
			return stringify(x, sd <= x.e || x.e <= Big.NE || x.e >= Big.PE, !!n);
		};
		P.valueOf = function() {
			var x = this, Big = x.constructor;
			if (Big.strict === true) throw Error(NAME + "valueOf disallowed");
			return stringify(x, x.e <= Big.NE || x.e >= Big.PE, true);
		};
		var Big = _Big_();
		//#endregion
		//#region lib/types/client/formatBalance.js
		/** Platform Web currency formatting for account balances; source amounts retain decimal precision. */
		/**
		* Format a balance using Platform Web's two-decimal and sub-cent display rules.
		* @param amount - validated decimal balance string.
		* @param symbol - currency symbol.
		* @returns signed currency text with grouped digits.
		*/
		function formatBalance(amount, symbol) {
			const value = new Big(amount);
			if (value.eq(0)) return `${symbol}0.00`;
			if (value.lt(0)) return `-${symbol}${value.gt(-.01) ? "0.01" : addCommas(value.abs().toFixed(2))}`;
			if (value.lt("0.01")) return `<${symbol}0.01`;
			return `${symbol}${addCommas(value.round(2, Big.roundDown).toFixed(2))}`;
		}
		function addCommas(value) {
			const [integer, fraction] = value.split(".");
			return `${Number(integer).toLocaleString()}.${fraction}`;
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-settings-account/src/client/AccountSection.module.css.mjs
		const css$2 = ".LcmJYa_section{color:var(--dsw-alias-label-primary);flex-direction:column;gap:16px;padding:8px 0;font-size:13px;line-height:22px;display:flex}.LcmJYa_card,.LcmJYa_balanceCard{border:.5px solid var(--dsw-alias-settings-card-stroke);border-radius:var(--dsw-radius-xl);background:var(--dsw-alias-settings-card-fill);padding:12px 16px}.LcmJYa_card,.LcmJYa_row{justify-content:space-between;align-items:center;gap:16px;display:flex}.LcmJYa_identity{align-items:center;gap:10px;min-width:0;min-height:44px;display:flex}.LcmJYa_avatar{corner-shape:round;width:32px;height:32px;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-skeleton);border-radius:50%;flex:none;justify-content:center;align-items:center;display:flex}.LcmJYa_identityCopy{flex-direction:column;min-width:0;display:flex}.LcmJYa_name{font-size:14px;font-weight:500}.LcmJYa_status,.LcmJYa_secondary,.LcmJYa_unavailable{color:var(--dsw-alias-label-tertiary)}.LcmJYa_balanceCard{flex-direction:column;gap:8px;display:flex}.LcmJYa_row{box-sizing:border-box;min-height:40px;padding:6px 0}.LcmJYa_divider{border-top:.5px solid var(--dsw-alias-border-l2)}.LcmJYa_links,.LcmJYa_actions{flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:10px;display:flex}.LcmJYa_linkButton{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);white-space:nowrap;min-width:58px;height:36px;color:var(--dsw-alias-label-primary);background:0 0;flex:none;justify-content:center;align-items:center;padding:0 14px;font-size:14px;line-height:22px;text-decoration:none;display:inline-flex}.LcmJYa_linkButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.LcmJYa_linkButton:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}.LcmJYa_unavailableLink{color:var(--dsw-alias-label-tertiary);text-underline-offset:3px;text-decoration:underline}.LcmJYa_unavailableLink:hover{color:var(--dsw-alias-label-primary)}.LcmJYa_unavailableLink:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px;border-radius:4px}.LcmJYa_primary{color:var(--dsw-alias-label-primary-foreground);background:var(--dsw-alias-button-primary-fill);border-color:#0000;font-weight:500}.LcmJYa_primary:hover{background:var(--dsw-alias-button-primary-hover)}.LcmJYa_signedOut{box-sizing:border-box;min-height:calc(100% + 16px);color:var(--dsw-alias-label-primary);flex-direction:column;justify-content:center;align-items:center;margin-bottom:-16px;padding-bottom:8px;display:flex}.LcmJYa_signedOutContent{flex-direction:column;justify-content:center;align-items:center;gap:20px;width:100%;min-height:60px;padding:12px 0;display:flex}.LcmJYa_signedOutCopy{text-align:center;flex-direction:column;gap:4px;width:100%;display:flex}.LcmJYa_signedOutTitle{font-size:14px;line-height:22px}.LcmJYa_signedOutDescription{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.LcmJYa_signInButton{min-width:72px;font-weight:500}.LcmJYa_amount{flex-wrap:wrap;justify-content:flex-end;font-size:18px;font-weight:510;line-height:28px;display:flex}.LcmJYa_amount>span+span:before{content:\" + \";white-space:pre}.LcmJYa_accountInfo{color:var(--dsw-alias-label-primary);flex:none;align-items:center;gap:2px;font-size:13px;line-height:22px;text-decoration:none;display:inline-flex}.LcmJYa_bonusValue{justify-content:flex-end;align-items:center;gap:8px;display:flex}";
		const tagId$2 = "@deepseek-ai/dsh-client-ui-settings-account/AccountSection.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-settings-account";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var AccountSection_module_css_default = {
			"accountInfo": "LcmJYa_accountInfo",
			"actions": "LcmJYa_actions",
			"amount": "LcmJYa_amount",
			"avatar": "LcmJYa_avatar",
			"balanceCard": "LcmJYa_balanceCard",
			"bonusValue": "LcmJYa_bonusValue",
			"card": "LcmJYa_card",
			"divider": "LcmJYa_divider",
			"identity": "LcmJYa_identity",
			"identityCopy": "LcmJYa_identityCopy",
			"linkButton": "LcmJYa_linkButton",
			"links": "LcmJYa_links",
			"name": "LcmJYa_name",
			"primary": "LcmJYa_primary",
			"row": "LcmJYa_row",
			"secondary": "LcmJYa_secondary",
			"section": "LcmJYa_section",
			"signInButton": "LcmJYa_signInButton",
			"signedOut": "LcmJYa_signedOut",
			"signedOutContent": "LcmJYa_signedOutContent",
			"signedOutCopy": "LcmJYa_signedOutCopy",
			"signedOutDescription": "LcmJYa_signedOutDescription",
			"signedOutTitle": "LcmJYa_signedOutTitle",
			"status": "LcmJYa_status",
			"unavailable": "LcmJYa_unavailable",
			"unavailableLink": "LcmJYa_unavailableLink"
		};
		//#endregion
		//#region lib/types/client/AccountSection.js
		/** Account settings renders safe Host state and explicit login actions. */
		/** @param props - localized actions, account subscription, and the shared Platform page channel. @returns account settings UI. */
		function AccountSection({ t, useAccount, useTheme, start, cancel, openPlatformPage, avatarFailed }) {
			const { view: state, details, avatar, failed: streamFailed } = useAccount((value) => value);
			const colorScheme = useTheme((snapshot) => snapshot.active.colorScheme);
			const releasePage = (0, react.useRef)(void 0);
			const [failed, setFailed] = (0, react.useState)(false);
			const [busy, setBusy] = (0, react.useState)(false);
			const profile = details?.profile?.status === "ready" ? details.profile.value : void 0;
			const wallets = details?.balance?.status === "ready" ? details.balance.value : void 0;
			const bonusWallets = details?.balance?.status === "ready" ? details.balance.bonusWallets.filter((wallet) => new Big(wallet.balance).gt(0)) : [];
			const showBonusRow = details?.balance?.status !== "ready" || bonusWallets.length > 0;
			const attempt = state?.attempt;
			const active = attempt !== null && attempt !== void 0 && [
				"initializing",
				"waiting-browser",
				"exchanging",
				"committing"
			].includes(attempt.phase);
			const signedIn = state?.status === "credential-stored";
			(0, react.useEffect)(() => () => {
				releasePage.current?.();
				releasePage.current = void 0;
			}, []);
			(0, react.useEffect)(() => {
				if (signedIn) return;
				releasePage.current?.();
				releasePage.current = void 0;
			}, [signedIn]);
			const showPage = (open, page) => {
				releasePage.current?.();
				releasePage.current = open(page, () => {
					releasePage.current = void 0;
				});
			};
			const run = async (action) => {
				setBusy(true);
				setFailed(false);
				try {
					await action();
				} catch {
					setFailed(true);
				} finally {
					setBusy(false);
				}
			};
			/**
			* @param event - click on a Platform destination link.
			* @returns nothing; on Desktop the embedded page replaces the pending navigation.
			*/
			const openUsage = (event) => {
				if (openPlatformPage !== void 0 && signedIn) {
					event.preventDefault();
					showPage(openPlatformPage, "usage");
				}
			};
			/**
			* The Platform entry the balance rows share with the Usage action: an embedded page on
			* Desktop, a new tab elsewhere. A wallet read that failed still reaches the same
			* destination, so the user can inspect the balance the Harness could not load; the
			* destination comes from the account links, not from the wallet response.
			* @param label - localized link copy.
			* @param className - link treatment for the row that renders it, absent when the sheet has no such rule.
			* @returns the Platform anchor.
			*/
			const platformLink = (label, className) => (0, react_jsx_runtime.jsx)("a", {
				className,
				href: state?.links.usageUrl,
				"aria-disabled": state === void 0,
				target: "_blank",
				rel: "noreferrer",
				onClick: openUsage,
				children: label
			});
			const status = failed || streamFailed || attempt?.phase === "failed" ? t("failed") : attempt?.phase === "expired" ? t("expired") : active ? t(attempt.phase === "initializing" ? "initializing" : attempt.phase === "waiting-browser" ? "waiting" : "completing") : signedIn ? profile?.contact ?? t(details?.profile === void 0 ? "loading" : "profileUnavailable") : t("signInDescription");
			if (!signedIn && !active) return (0, react_jsx_runtime.jsx)("section", {
				className: AccountSection_module_css_default.signedOut,
				"aria-label": t("nav"),
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: AccountSection_module_css_default.signedOutContent,
					children: [(0, react_jsx_runtime.jsxs)("div", {
						className: AccountSection_module_css_default.signedOutCopy,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: AccountSection_module_css_default.signedOutTitle,
							children: t("settingsSignedOutTitle")
						}), (0, react_jsx_runtime.jsx)("span", {
							className: AccountSection_module_css_default.signedOutDescription,
							role: "status",
							children: failed || streamFailed ? t("failed") : t("settingsSignedOutDescription")
						})]
					}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						className: AccountSection_module_css_default.signInButton,
						disabled: busy || state === void 0,
						onClick: () => {
							run(start);
						},
						children: t("signIn")
					})]
				})
			});
			return (0, react_jsx_runtime.jsxs)("section", {
				className: AccountSection_module_css_default.section,
				"aria-label": t("nav"),
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: AccountSection_module_css_default.card,
						children: [(0, react_jsx_runtime.jsxs)("div", {
							className: AccountSection_module_css_default.identity,
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: AccountSection_module_css_default.avatar,
								"data-avatar-status": signedIn ? avatar?.status : void 0,
								children: (0, react_jsx_runtime.jsx)(AccountAvatar, {
									avatar: signedIn ? avatar : void 0,
									avatarFailed
								})
							}), (0, react_jsx_runtime.jsxs)("div", {
								className: AccountSection_module_css_default.identityCopy,
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: AccountSection_module_css_default.name,
									children: signedIn ? profile?.name ?? t("signedIn") : t("signedOut")
								}), (0, react_jsx_runtime.jsx)("span", {
									className: AccountSection_module_css_default.status,
									role: "status",
									children: status
								})]
							})]
						}), signedIn && (0, react_jsx_runtime.jsxs)("a", {
							className: AccountSection_module_css_default.accountInfo,
							href: new URL("/", state.links.usageUrl).href,
							target: "_blank",
							rel: "noopener noreferrer",
							children: [t("accountInfo"), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRightUpOutlineRegular, { size: 12 })]
						})]
					}),
					active && (0, react_jsx_runtime.jsxs)("div", {
						className: AccountSection_module_css_default.actions,
						children: [attempt.authorizeUrl && (0, react_jsx_runtime.jsx)("a", {
							className: AccountSection_module_css_default.linkButton,
							href: authorizeUrlWithTheme(attempt.authorizeUrl, colorScheme),
							target: "_blank",
							rel: "noreferrer",
							children: t("open")
						}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: busy || attempt.phase === "committing",
							onClick: () => {
								run(() => cancel(attempt.id));
							},
							children: t("cancel")
						})]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: AccountSection_module_css_default.balanceCard,
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: AccountSection_module_css_default.row,
								children: [(0, react_jsx_runtime.jsx)("span", { children: t("balance") }), signedIn && wallets !== void 0 && wallets.length > 0 ? (0, react_jsx_runtime.jsx)("span", {
									className: AccountSection_module_css_default.amount,
									children: wallets.map((wallet) => (0, react_jsx_runtime.jsx)("span", { children: formatBalance(wallet.balance, wallet.currency === "CNY" ? "¥" : "$") }, wallet.currency))
								}) : !signedIn || details?.balance === void 0 ? (0, react_jsx_runtime.jsx)("span", {
									className: AccountSection_module_css_default.unavailable,
									children: t(!signedIn ? "balanceSignedOut" : "loading")
								}) : platformLink(t("balanceUnavailable"), AccountSection_module_css_default.unavailableLink)]
							}),
							signedIn && showBonusRow && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("div", { className: AccountSection_module_css_default.divider }), (0, react_jsx_runtime.jsxs)("div", {
								className: AccountSection_module_css_default.row,
								children: [(0, react_jsx_runtime.jsx)("span", { children: t("bonusBalance") }), (0, react_jsx_runtime.jsx)("span", {
									className: AccountSection_module_css_default.bonusValue,
									children: bonusWallets.length > 0 ? (0, react_jsx_runtime.jsx)("span", {
										className: AccountSection_module_css_default.amount,
										children: bonusWallets.map((wallet) => (0, react_jsx_runtime.jsx)("span", { children: formatBalance(wallet.balance, wallet.currency === "CNY" ? "¥" : "$") }, wallet.currency))
									}) : details?.balance === void 0 ? (0, react_jsx_runtime.jsx)("span", {
										className: AccountSection_module_css_default.unavailable,
										children: t("loading")
									}) : platformLink(t("balanceUnavailable"), AccountSection_module_css_default.unavailableLink)
								})]
							})] }),
							(0, react_jsx_runtime.jsx)("div", { className: AccountSection_module_css_default.divider }),
							(0, react_jsx_runtime.jsxs)("div", {
								className: AccountSection_module_css_default.row,
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: AccountSection_module_css_default.secondary,
									children: t("more")
								}), (0, react_jsx_runtime.jsxs)("div", {
									className: AccountSection_module_css_default.links,
									children: [platformLink(t("usage"), AccountSection_module_css_default.linkButton), (0, react_jsx_runtime.jsx)("a", {
										className: `${AccountSection_module_css_default.linkButton} ${AccountSection_module_css_default.primary}`,
										href: state?.links.topUpUrl,
										"aria-disabled": state === void 0,
										target: "_blank",
										rel: "noreferrer",
										onClick: (event) => {
											if (openPlatformPage !== void 0 && signedIn) {
												event.preventDefault();
												showPage(openPlatformPage, "top-up");
											}
										},
										children: t("topUp")
									})]
								})]
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/bonus-notices.js
		/**
		* @param expiresAt - server expiration timestamp.
		* @param at - milliseconds since epoch.
		* @returns whether the bonus can no longer be shown.
		*/
		function expired(expiresAt, at) {
			const expires = Date.parse(expiresAt);
			return !Number.isNaN(expires) && expires <= at;
		}
		/**
		* Own the read, display, and acknowledgement lifecycle of bonus notices.
		* @param options - collaborators and timings.
		* @returns the controller the account plugin drives from account and settings state.
		*/
		function createBonusNoticeController(options) {
			let scope;
			/** Notice currently published to the sidebar, including the expiration checked at display time. */
			let current;
			/** Newest read; an older read still in flight has its result dropped once a newer one starts. */
			let readGeneration = 0;
			let ackTimer;
			let ackInFlight = false;
			let ackDelay = options.ackRetryDelayMs;
			/** Orders the card on screen already reported, so one mount cannot acknowledge twice. */
			const reported = /* @__PURE__ */ new Set();
			const clearAckTimer = () => {
				if (ackTimer !== void 0) {
					clearTimeout(ackTimer);
					ackTimer = void 0;
				}
			};
			const setCurrent = (notice) => {
				if (notice === void 0 && current === void 0) return;
				if (notice?.orderId === current?.orderId && notice?.message === current?.message && notice?.expiresAt === current?.expiresAt) return;
				if (notice?.orderId !== current?.orderId) reported.clear();
				current = notice;
				options.publish(notice ?? null);
			};
			const scheduleAck = (delay) => {
				clearAckTimer();
				ackTimer = setTimeout(() => {
					runAcks();
				}, delay);
			};
			/** Drop acknowledgement work of the previous account or lifecycle, so its carry-over cannot reach the next one. */
			const resetAcks = () => {
				clearAckTimer();
				ackInFlight = false;
				ackDelay = options.ackRetryDelayMs;
			};
			const startAcks = () => {
				if (scope !== void 0 && scope.pending.length > 0) scheduleAck(0);
			};
			/**
			* Apply one read result. A newly offered order replaces the on-screen card;
			* an offer equal to the on-screen card refreshes its copy in place, and an
			* empty batch leaves a card the user has already seen alone.
			*/
			const apply = (scopeAtRead, batch) => {
				if (scopeAtRead.accountId !== batch.accountId) {
					scopeAtRead.accountId = batch.accountId;
					scopeAtRead.pending.length = 0;
					resetAcks();
					setCurrent(void 0);
				}
				const candidate = batch.bonuses[0];
				if (candidate === void 0) {
					if (current !== void 0 && !reported.has(current.orderId)) setCurrent(void 0);
					return;
				}
				if (candidate.orderId === current?.orderId) {
					setCurrent({
						orderId: candidate.orderId,
						message: candidate.message,
						expiresAt: candidate.expiresAt
					});
					return;
				}
				if (expired(candidate.expiresAt, Date.now())) return;
				setCurrent({
					orderId: candidate.orderId,
					message: candidate.message,
					expiresAt: candidate.expiresAt
				});
			};
			/**
			* Read once for one live lifecycle. A newer read supersedes one in flight: the
			* older result is dropped instead of applied, so only the newest read can report
			* an account change.
			* @param scopeAtRead - lifecycle this read belongs to.
			* @returns after this read settles.
			*/
			function runRead(scopeAtRead) {
				const generation = ++readGeneration;
				return (async () => {
					let batch;
					try {
						batch = await options.read();
					} catch {
						batch = null;
					}
					if (scope !== scopeAtRead || generation !== readGeneration) return;
					if (batch !== null) apply(scopeAtRead, batch);
				})();
			}
			/**
			* Acknowledge presented orders one at a time. A protocol failure backs off up
			* to the ceiling and retries for the rest of the signed-in lifecycle, which
			* never persists. A false answer settles the order without a retry: this
			* session cannot make the server accept it. A hidden window keeps retrying,
			* because the presented frame is what a pending acknowledgement proves.
			*/
			async function runAcks() {
				const scopeAtCall = scope;
				if (scopeAtCall === void 0 || ackInFlight) return;
				const accountId = scopeAtCall.accountId;
				const orderId = scopeAtCall.pending[0];
				/* v8 ignore next -- an acknowledgement runs only while a read named the account and left a pending order */
				if (accountId === void 0 || orderId === void 0) return;
				ackInFlight = true;
				/** @returns whether this call still owns the lifecycle and account it started for. */
				const owns = () => scope === scopeAtCall && scopeAtCall.accountId === accountId;
				let acknowledged;
				try {
					acknowledged = await options.acknowledge(accountId, orderId);
				} catch {
					if (!owns()) return;
					ackInFlight = false;
					scheduleAck(ackDelay);
					ackDelay = Math.min(ackDelay * 2, options.ackRetryMaxDelayMs);
					return;
				}
				if (!owns()) return;
				ackInFlight = false;
				/* v8 ignore next -- the call owns the scope, and this order is its head until this shift */
				if (scopeAtCall.pending[0] === orderId) scopeAtCall.pending.shift();
				ackDelay = options.ackRetryDelayMs;
				if (acknowledged && scopeAtCall.pending.length > 0) scheduleAck(0);
				else clearAckTimer();
			}
			/** Queue a presented order, so an acknowledgement interrupted by a failure retries within this sign-in. */
			const report = (orderId) => {
				const scopeAtReport = scope;
				if (scopeAtReport === void 0 || current?.orderId !== orderId || reported.has(orderId)) return;
				reported.add(orderId);
				if (!scopeAtReport.pending.includes(orderId)) scopeAtReport.pending.push(orderId);
				ackDelay = options.ackRetryDelayMs;
				scheduleAck(0);
			};
			const endLifecycle = () => {
				if (scope === void 0) return;
				resetAcks();
				scope = void 0;
				reported.clear();
				setCurrent(void 0);
			};
			return {
				begin() {
					scope ??= { pending: [] };
					runRead(scope);
				},
				end: endLifecycle,
				refresh() {
					if (scope === void 0) return Promise.resolve();
					startAcks();
					return runRead(scope);
				},
				shown(orderId) {
					if (current?.orderId !== orderId) return;
					if (expired(current.expiresAt, Date.now())) return;
					report(orderId);
				},
				dismiss(orderId) {
					if (current?.orderId !== orderId) return;
					report(orderId);
					setCurrent(void 0);
				}
			};
		}
		//#endregion
		//#region lib/types/client/client-metadata.js
		/**
		* Build the request identity for one account call.
		* @param locale - active UI language; the Host reduces it to the Platform wire locale.
		* @param version - client build version inlined by the bundle.
		* @returns the metadata the account Remote methods carry.
		* @throws Error when the build carries no version, instead of reporting an empty one.
		*/
		function accountClientMetadata(locale, version) {
			if (version === void 0 || version === "") throw new Error("account: this client build carries no DSH_CLIENT_VERSION");
			return {
				version,
				locale,
				timezoneOffsetSeconds: -(/* @__PURE__ */ new Date()).getTimezoneOffset() * 60
			};
		}
		//#endregion
		//#region lib/types/client/locales/onboarding.js
		/** Chinese first-run copy from the onboarding requirements. */
		const onboardingCopy = {
			onboardingArtworkLocale: "zh",
			onboardingWelcome: "欢迎使用",
			onboardingBrand: "DeepSeek Harness",
			onboardingIntroduction: "DeepSeek Harness 会以本地文件夹作为工作区，通过调用各种工具，读写本机文件，完成搜索整理资料、制作文档表格、编写代码、排查问题等各种任务。",
			onboardingStart: "开始设置",
			onboardingCredit: "准备可用额度",
			onboardingCreditDescription: "DeepSeek Harness 执行任务时，会根据模型与工具使用的 token 量扣除额度。请提前添加额度，避免任务在执行过程中被迫中断。你的余额只会在 Agent 实际执行任务时消耗。",
			onboardingTopUp: "去充值",
			onboardingLater: "下一步",
			onboardingFundedTopUp: "去充值",
			onboardingPurposePrefix: "你希望",
			onboardingPurposeSuffix: "帮你做什么？",
			onboardingPurposeDescription: "我们会根据你的选择调整界面和工具，以更适合你的工作方式。",
			onboardingOffice: "办公与创作",
			onboardingOfficeDescription: "编辑文档、整理数据和制作演示文稿等",
			onboardingDevelopment: "代码与开发",
			onboardingDevelopmentDescription: "修改代码、调试问题、运行命令和管理项目文件等",
			onboardingContinue: "继续",
			onboardingProcess: "你希望看到多少工作过程？",
			onboardingProcessDescription: "这只会影响工作过程的展示方式，不会影响 DeepSeek Harness 的工作能力。",
			onboardingCompact: "聚焦结果",
			onboardingCompactDescription: "只看结果，保持界面简洁明了",
			onboardingStandard: "关键细节",
			onboardingStandardDescription: "结果优先，仅展示重要步骤和关键操作",
			onboardingDetailed: "完整过程",
			onboardingDetailedDescription: "查看完整工作过程，方便调试和排查问题",
			onboardingEnter: "进入应用",
			onboardingBack: "上一步",
			onboardingSkip: "跳过",
			onboardingSkipTitle: "跳过设置？",
			onboardingSkipDescription: "你可以随时前往 设置 → 通用设置 中调整工作过程、性能与用量展示方式或开启代码工作工具。",
			onboardingKeepSetting: "继续设置",
			onboardingNoCreditTitle: "暂时跳过充值？",
			onboardingNoCreditDescription: "没有可用额度时，DeepSeek Harness 将无法开始新的任务。你可以稍后前往 设置 → 账号与余额 进行充值。",
			onboardingUnderstood: "我知道了",
			onboardingGoTopUp: "前往充值",
			onboardingSaveFailed: "未能保存设置，请重试。",
			onboardingRetry: "重试",
			onboardingLoading: "正在加载设置…"
		};
		//#endregion
		//#region lib/types/client/locales.js
		/** Account settings copy, owned by the account feature. */
		/** English account dictionary. */
		const en = {
			modelSignInRequired: "Model unavailable. Please sign in and try again.",
			sessionExpired: "You have signed out of your account, please log in again.",
			onboardingArtworkLocale: "en",
			onboardingWelcome: "Welcome to",
