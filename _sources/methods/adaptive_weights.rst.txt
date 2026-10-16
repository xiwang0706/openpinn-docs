损失平衡与自适应权重
====================

.. openpinn-method-summary:: adaptive_weights self_adaptive

这个家族现在包含不同机制，不能只看“都是权重”就认为公式相同。旧默认
``self_adaptive`` 是每个损失项一个梯度上升权重；新增页面分别说明不确定性权重、
ReLoBRaLo、固定幂损失和完整逐点 SA-PINN。

.. toctree::
   :maxdepth: 1

   adaptive_weights/uncertainty_weighting
   adaptive_weights/relobralo
   adaptive_weights/magnitude_power
   adaptive_weights/pointwise_self_adaptive

原有默认：项级自适应权重
--------------------------

这是什么
----------

Burgers PINN 同时有 PDE、边界和初值损失。固定权重始终是 1；自适应版本让
三个正权重也参与训练。网络参数最小化加权损失，权重参数最大化同一目标，
使持续误差大的项得到更多关注。

放在哪里
----------

* 权重容器：``src/openpinn/losses.py`` 的 ``AdaptiveLossComposer``；
* 下降/上升交替：``src/openpinn/training.py``；
* 统一调用：``loss.weighting.name: self_adaptive``；
* 对比入口：``examples/burgers_adaptive_weights.py``。

实现范围要说清
--------------

论文的完整 SA-PINN 给每个配点一个可训练掩码。OpenPINN 当前的公共接口输出
的是三个已经取平均的标量损失，所以这一步接入的是“每项一个可训练权重”。
它保留了梯度下降/上升的鞍点思路，但不是论文逐配点方法的完整复刻。

依据与许可
----------

* 核心论文：McClenny and Braga-Neto, *Self-adaptive
  physics-informed neural networks*, Journal of Computational Physics 474
  (2023) 111722，DOI ``10.1016/j.jcp.2022.111722``。
* 参考仓库：``https://github.com/levimcclenny/SA-PINNs``。该仓库未检测到明确
  LICENSE，不把它视为可自由复制的代码。
* 本实现仅依据论文的鞍点概念独立编写，没有复制、改写或翻译参考仓库代码。

最短调用
--------

.. code-block:: python

   import openpinn as op
   result = op.solve(
       "burgers", method="adaptive_weights", variant="self_adaptive", steps=5000
   )

怎么跑
------

.. code-block:: bash

   PYTHONPATH=src python -m examples.burgers_adaptive_weights \
     --output-dir runs/burgers_adaptive_weights_<timestamp>

公平对比
--------

两组共用同一 Burgers 方程、随机种子、采样、64×4 MLP、Adam 和 1500 步。
三个权重都从 1 开始。普通组固定不动；改进组每步使用学习率 0.01 的 SGD
做一次权重梯度上升。改进组因方法本身多 3 个标量参数。

参考实验结果
------------

2026-08-26 在 CPU 上使用固定随机种完成 1500 步对比。两组都完成，
1500 条权重历史、checkpoint、预测和 SVG 均通过结构/有限值检查。
Cole–Hopf 参考解只用于训练后评价。

.. list-table::
   :header-rows: 1

   * - 方法
     - 相对 L2
     - 最大绝对误差
     - PDE 残差 RMSE
     - 边界 RMSE
     - 初值 RMSE
     - 训练时间
   * - 固定权重
     - 0.40998
     - 0.93943
     - 0.22334
     - 0.03762
     - 0.22689
     - 4.015 s
   * - 自适应权重
     - 0.38543
     - 0.92323
     - 0.25131
     - 0.06188
     - 0.20291
     - 4.600 s

.. image:: /_static/methods/adaptive_weights.svg
   :alt: Burgers 固定损失权重与自适应损失权重的四时间片、误差和损失对比
   :width: 100%

自适应组最终学到的 PDE、边界和初值权重分别为 1.380、1.045 和 1.578。
完整结果位于 ``results/methods/burgers_adaptive_weights_reference_20260826/``。相对 L2、最大误差和
初值 RMSE 更低，但 PDE 残差、边界 RMSE 和用时更高，因此不能声称整体更优。该参考实验只确认了
权重为正、会更新，并且可完整保存/恢复其训练状态。

限制和失败记录
--------------

* 权重上升过快会使训练不稳定，所以配置显式给出学习率和上限。
* ``self_adaptive`` 是“每项一个权重”；完整逐配点版本已经作为独立的
  ``pointwise_self_adaptive`` 变体接入，不能混用两个简称。
* 仅一个固定种子，不作统计优越声明。
* 学到的权重保存到 ``metrics.json``、``history.csv`` 和 checkpoint；失败另存
  ``failure.json`` 与 ``failure_notes.md``。
