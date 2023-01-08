// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Subscription is ERC721, Ownable {
    using Counters for Counters.Counter;

    IERC20 busd;
    address admin;

    Counters.Counter private _tokenIds;

    uint256 busdBalance;

    enum TierType {
        NONE,
        VeryHappy,
        Happy,
        Moody,
        Sad,
        VerySad
    }

    struct Tier {
        uint256 price;
        uint32 maxSupply;
        uint32 totalSupply;
        string ipfsCID;
    }

    mapping(TierType => Tier) tiers;

    mapping(address => TierType) private _userTier;
    mapping(uint256 => TierType) private _tokenTier;
    mapping(address => uint256) private _userToken;

    error AlreadyHasNFT();

    event Withdraw(address indexed from, address indexed to, uint256 amount);
    event BuyNFT(address indexed to, uint256 tokenId, TierType tier);
    event TransferNFT(address indexed from, address indexed to, uint256 tokenId, TierType tire);

    constructor(address _busd, address _admin) ERC721("Subscription", "SBR") {
        tiers[TierType.VeryHappy] = Tier({price: 50_000 ether, maxSupply: 1_000, totalSupply: 0, ipfsCID: "QmZY5rc2BBWUy5fvj1SopJZ5Dns2sDz14a5DqaJaE2ecVq"});
        tiers[TierType.Happy] = Tier({price: 10_000 ether, maxSupply: 10_000, totalSupply: 0, ipfsCID: "QmYUtLEMPsbRuUdrqCo2d6VqSuSCYRGApVssLrSbmFTEKD"});
        tiers[TierType.Moody] = Tier({price: 1_000 ether, maxSupply: 100_000, totalSupply: 0, ipfsCID: "QmR16twEdHLRGXVLqvRUq4h4PDbkiofaAXoCmaZTVkqprF"});
        tiers[TierType.Sad] = Tier({price: 500 ether, maxSupply: 500_000, totalSupply: 0, ipfsCID: "QmWGYsk3E5bpX7q5ZR6N8tny1xpCWu4aC9bdSvBfPG81Sr"});
        tiers[TierType.VerySad] = Tier({price: 100 ether, maxSupply: 1_000_000, totalSupply: 0, ipfsCID: "QmXn8MndJKifq1JNuUbkLvhTTga5DEjnysddCp2kGt1b6E"});

        busd = IERC20(_busd);
        admin = _admin;
        transferOwnership(_admin);
    }

    function buy(TierType _tier) public {
        require(_isValidTier(uint8(_tier)), "invalid tier");
        
        Tier storage tier = tiers[_tier];

        require(tier.totalSupply + 1 <= tier.maxSupply, "out of supply");

        if(_checkHasTier(msg.sender)) {
            revert AlreadyHasNFT();
        }

        // transfer required BUSD to the contract
        busd.transferFrom(msg.sender, address(this), tier.price); // allowance will check by erc20 itself

        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current(); 
        
        _safeMint(msg.sender, newTokenId);

        _tokenTier[newTokenId] = _tier;
        _userTier[msg.sender] = _tier;
        _userToken[msg.sender] = newTokenId;

        tier.totalSupply = tier.totalSupply + 1;

        busdBalance += tier.price;

        emit BuyNFT(msg.sender, newTokenId, _tier);
    }

    function _baseURI() internal pure override returns (string memory) {
        return "ipfs://";
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireMinted(tokenId);

        Tier memory tier = tiers[_tokenTier[tokenId]];
        string memory tokenCID = tier.ipfsCID;

        string memory baseURI = _baseURI();
        return bytes(tokenCID).length > 0 ? string(abi.encodePacked(baseURI, tokenCID)) : "";
    }

    function tierOf(address _address) external view returns (TierType _tire) {
        _tire = _userTier[_address];
    }

    function userIsVeryHappy(address _address) external view returns (bool) {
        return _userTier[_address] == TierType.VeryHappy;
    }

    function userIsHappy(address _address) external view returns (bool) {
        return _userTier[_address] == TierType.Happy;
    }

    function userIsMoody(address _address) external view returns (bool) {
        return _userTier[_address] == TierType.Moody;
    }

    function userIsSad(address _address) external view returns (bool) {
        return _userTier[_address] == TierType.Sad;
    }

    function userIsVerySad(address _address) external view returns (bool) {
        return _userTier[_address] == TierType.VerySad;
    }

    function userToken(address _address) external view returns (uint256) {
        uint256 tokenId = _userToken[_address];
        _requireMinted(tokenId);
        return tokenId;
    }

    function withdraw() external onlyOwner {
        uint256 amount = busdBalance;
        busdBalance = 0;

        busd.transfer(admin, amount);

        emit Withdraw(address(this), admin, amount);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);

        if(_checkHasTier(to)) {
            revert AlreadyHasNFT();
        }
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override {
        super._afterTokenTransfer(from, to, tokenId, batchSize);

        TierType tier = _userTier[from];

        delete _userTier[from];
        _userTier[to] = tier;

        delete _userToken[from];
        _userToken[to] = tokenId;

        emit TransferNFT(from, to, tokenId, tier);
    }

    function _checkHasTier(address _address) internal view returns (bool) {
        TierType tierType = _userTier[_address];
        return _isValidTier(uint8(tierType));
    }

    function _isValidTier(uint8 _tier) internal pure returns (bool) {
         return _tier == uint8(TierType.VeryHappy) ||
                _tier == uint8(TierType.Happy) || 
                _tier == uint8(TierType.Moody) || 
                _tier == uint8(TierType.Sad) || 
                _tier == uint8(TierType.VerySad);
    }
}