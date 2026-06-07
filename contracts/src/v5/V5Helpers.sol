// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title V5Helpers - JSON parsing, string utilities, and date formatting
/// @notice Gas-efficient on-chain helpers for agent response parsing
library V5Helpers {

    uint256 private constant NOT_FOUND = type(uint256).max;

    // ═══════════════════════════════════════════════════════════════
    // JSON PARSING
    // ═══════════════════════════════════════════════════════════════

    /// @notice Extract string value for a given key from JSON
    /// @param json The JSON string to parse
    /// @param key The key to look up (without quotes)
    /// @return The extracted string value, or empty string if not found
    function jsonString(string memory json, string memory key) internal pure returns (string memory) {
        bytes memory data = bytes(json);
        bytes memory needle = bytes(string.concat('"', key, '":'));
        uint256 start = _find(data, needle);
        if (start == NOT_FOUND) return "";
        start += needle.length;
        start = _skipWhitespace(data, start);
        if (start >= data.length || data[start] != '"') return "";
        start++;
        uint256 end = start;
        while (end < data.length && data[end] != '"') {
            if (data[end] == '\\' && end + 1 < data.length) end++;
            end++;
        }
        return _slice(data, start, end);
    }

    /// @notice Extract uint value for a given key from JSON
    /// @param json The JSON string to parse
    /// @param key The key to look up
    /// @return The extracted uint value, or 0 if not found
    function jsonUint(string memory json, string memory key) internal pure returns (uint256) {
        bytes memory data = bytes(json);
        bytes memory needle = bytes(string.concat('"', key, '":'));
        uint256 start = _find(data, needle);
        if (start == NOT_FOUND) return 0;
        start += needle.length;
        while (start < data.length && (data[start] < '0' || data[start] > '9')) start++;
        uint256 value;
        while (start < data.length && data[start] >= '0' && data[start] <= '9') {
            value = value * 10 + uint8(data[start]) - 48;
            start++;
        }
        return value;
    }

    // ═══════════════════════════════════════════════════════════════
    // STRING UTILITIES
    // ═══════════════════════════════════════════════════════════════

    /// @notice Check if outcome string represents YES
    function isYes(string memory value) internal pure returns (bool) {
        return equals(value, "YES") || equals(value, "yes") || equals(value, "Yes");
    }

    /// @notice String equality check
    function equals(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    /// @notice Case-insensitive substring search
    /// @return true if needle is found in haystack
    function contains(string memory haystack, string memory needle) internal pure returns (bool) {
        return _find(bytes(haystack), bytes(needle)) != NOT_FOUND;
    }

    /// @notice Clamp value between min and max
    function bound(uint256 value, uint256 min, uint256 max) internal pure returns (uint256) {
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }

    /// @notice Truncate string to maxLen bytes
    function truncate(string memory s, uint256 maxLen) internal pure returns (string memory) {
        bytes memory data = bytes(s);
        if (data.length <= maxLen) return s;
        return _slice(data, 0, maxLen);
    }

    // ═══════════════════════════════════════════════════════════════
    // NUMBER / DATE FORMATTING
    // ═══════════════════════════════════════════════════════════════

    /// @notice Convert uint to decimal string
    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) { digits--; buffer[digits] = bytes1(uint8(48 + value % 10)); value /= 10; }
        return string(buffer);
    }

    /// @notice Format timestamp as "YYYY-MM-DD" string
    /// @param timestamp Unix timestamp
    function toDateStr(uint256 timestamp) internal pure returns (string memory) {
        uint256 z = timestamp / 86400 + 719468;
        uint256 era = z / 146097;
        uint256 doe = z - era * 146097;
        uint256 yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        uint256 y = yoe + era * 400;
        uint256 doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        uint256 mp = (5 * doy + 2) / 153;
        uint256 d = doy - (153 * mp + 2) / 5 + 1;
        uint256 mo = mp < 10 ? mp + 3 : mp - 9;
        if (mo <= 2) y++;

        return string(abi.encodePacked(
            toString(y), "-", _pad2(mo), "-", _pad2(d)
        ));
    }

    /// @notice Parse deadline days from LLM response, clamped to [1, 7]
    /// @param json The LLM JSON response containing a "deadline" field
    /// @return Number of days from now (1-7)
    function deadlineDays(string memory json, uint256 currentTimestamp) internal pure returns (uint256) {
        string memory deadlineStr = jsonString(json, "deadline");
        if (bytes(deadlineStr).length < 10) return 7;

        uint256 deadlineTs = _parseDateToTimestamp(deadlineStr);
        if (deadlineTs <= currentTimestamp) return 1;

        uint256 diff = (deadlineTs - currentTimestamp) / 1 days;
        return bound(diff, 1, 7);
    }

    // ═══════════════════════════════════════════════════════════════
    // INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════════════

    function _find(bytes memory haystack, bytes memory needle) private pure returns (uint256) {
        if (needle.length == 0 || needle.length > haystack.length) return NOT_FOUND;
        uint256 limit = haystack.length - needle.length;
        for (uint256 i = 0; i <= limit; i++) {
            bool matched = true;
            for (uint256 j = 0; j < needle.length; j++) {
                if (haystack[i + j] != needle[j]) { matched = false; break; }
            }
            if (matched) return i;
        }
        return NOT_FOUND;
    }

    function _skipWhitespace(bytes memory data, uint256 pos) private pure returns (uint256) {
        while (pos < data.length && (data[pos] == ' ' || data[pos] == '\t' || data[pos] == '\n' || data[pos] == '\r')) pos++;
        return pos;
    }

    function _slice(bytes memory data, uint256 start, uint256 end) private pure returns (string memory) {
        bytes memory out = new bytes(end - start);
        for (uint256 i = 0; i < out.length; i++) out[i] = data[start + i];
        return string(out);
    }

    function _pad2(uint256 v) private pure returns (string memory) {
        if (v < 10) return string(abi.encodePacked("0", toString(v)));
        return toString(v);
    }

    /// @dev Parse "YYYY-MM-DD" string to approximate timestamp
    function _parseDateToTimestamp(string memory dateStr) private pure returns (uint256) {
        bytes memory b = bytes(dateStr);
        if (b.length < 10) return 0;

        uint256 y = _parseDigits(b, 0, 4);
        uint256 mo = _parseDigits(b, 5, 7);
        uint256 d = _parseDigits(b, 8, 10);

        if (y < 2024 || mo == 0 || mo > 12 || d == 0 || d > 31) return 0;

        // Approximate: days since epoch
        uint256 totalDays = (y - 1970) * 365 + (y - 1969) / 4;
        uint8[12] memory monthDays = [31,28,31,30,31,30,31,31,30,31,30,31];
        for (uint256 i = 0; i < mo - 1; i++) totalDays += monthDays[i];
        totalDays += d - 1;

        return totalDays * 86400;
    }

    function _parseDigits(bytes memory b, uint256 start, uint256 end) private pure returns (uint256) {
        uint256 result;
        for (uint256 i = start; i < end && i < b.length; i++) {
            uint8 c = uint8(b[i]);
            if (c < 48 || c > 57) return 0;
            result = result * 10 + (c - 48);
        }
        return result;
    }
}
