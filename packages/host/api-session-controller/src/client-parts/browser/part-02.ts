/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN THAN nua client @galaxy-blackhole/gbh-host-typert-gateway — sinh boi tools/split-client-bundle.ts
 */
// @ts-nocheck

		//#region lib/types/client/sessions/history-records.js
		/** Client range access and type narrowing for aligned Session history records. */
		/**
		* Narrow aligned wire records to their Client event types without allocation.
		* @param records - validated history transport records.
		* @returns the same record array with typed inner events.
		*/
		function historyEntries(records) {
			return records;
		}
		/**
		* Read the first logical sequence represented by one wire record.
		* @param record - validated Session event.
		* @returns inclusive first Session sequence.
		*/
		function historyRecordFirstSeq(record) {
			return record.event.seq;
		}
		/**
		* Read the final logical sequence represented by one wire record.
		* @param record - validated Session event.
		* @returns inclusive final Session sequence.
		*/
		function historyRecordLastSeq(record) {
			return record.event.seq;
		}
		//#endregion

export {};
